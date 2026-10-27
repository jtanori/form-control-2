package com.voiceform.ui

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.voiceform.CoreSettings
import com.voiceform.Log
import com.voiceform.R
import com.voiceform.VoiceFormService
import com.voiceform.model.Command
import com.voiceform.model.ExecutionResult
import com.voiceform.model.ParseResponse
import com.voiceform.voice.VoiceClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * AND-004 — floating overlay: mic → transcript → parse → confirm card → execute.
 * Dismiss/drag affordances included; TYPE_APPLICATION_OVERLAY after user grant.
 */
class OverlayVoice(private val service: VoiceFormService) {

    private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private var root: LinearLayout? = null
    private var statusView: TextView? = null
    private var voice: VoiceClient? = null

    private var lastParse: ParseResponse? = null
    private var pendingCommands: List<Command> = emptyList()

    @SuppressLint("ClickableViewAccessibility", "InflateParams")
    fun show() {
        if (root != null) return
        val view = LayoutInflater.from(service).inflate(R.layout.overlay_voice, null)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 24
            y = 160
        }

        statusView = view.findViewById(R.id.status)
        val mic: Button = view.findViewById(R.id.mic)
        val drag: View = view.findViewById(R.id.drag)
        val close: Button = view.findViewById(R.id.close)

        mic.setOnClickListener { toggleMic(mic) }
        close.setOnClickListener { hide() }

        var lastX = 0
        var lastY = 0
        drag.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    lastX = event.rawX.toInt()
                    lastY = event.rawY.toInt()
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x += event.rawX.toInt() - lastX
                    params.y += event.rawY.toInt() - lastY
                    lastX = event.rawX.toInt()
                    lastY = event.rawY.toInt()
                    wm.updateViewLayout(view, params)
                    true
                }
                else -> false
            }
        }

        try {
            wm.addView(view, params)
            root = view as LinearLayout
            setStatus("Tap mic or type via STT…")
        } catch (e: SecurityException) {
            Log.e("overlay", "overlay permission missing", mapOf("error" to (e.message ?: "")))
            Toast.makeText(
                service,
                "Enable “Display over other apps” for VoiceForm",
                Toast.LENGTH_LONG,
            ).show()
        }
    }

    fun hide() {
        root?.let { runCatching { wm.removeView(it) } }
        root = null
        statusView = null
        voice?.stop()
        voice = null
    }

    private fun toggleMic(mic: Button) {
        if (voice != null) {
            voice?.stop()
            voice = null
            mic.text = service.getString(R.string.overlay_mic)
            return
        }
        voice = VoiceClient(
            service,
            onResult = { transcript ->
                main.post {
                    mic.text = service.getString(R.string.overlay_mic)
                    voice = null
                    onTranscript(transcript)
                }
            },
            onError = { err ->
                main.post {
                    mic.text = service.getString(R.string.overlay_mic)
                    voice = null
                    setStatus("STT: $err")
                }
            },
        )
        mic.text = "●"
        voice?.startListening()
    }

    private fun onTranscript(transcript: String) {
        setStatus("“$transcript” — parsing…")
        val snapshot = service.sessionSnapshot()
        Log.i("overlay", "parse", mapOf("transcriptLength" to transcript.length))
        scope.launch {
            try {
                val client = CoreSettings.newClient(service)
                val sessionId = snapshot?.sessionId
                val result = withContext(Dispatchers.IO) {
                    client.parse(transcript, snapshot!!, sessionId)
                }
                lastParse = result
                withContext(Dispatchers.Main) {
                    if (result.needsClarification) {
                        showClarification(result)
                    } else if (result.commands.isEmpty()) {
                        setStatus("No commands matched")
                    } else {
                        pendingCommands = result.commands
                        showConfirm(result)
                    }
                }
            } catch (e: Exception) {
                Log.e("overlay", "parse failed", mapOf("error" to (e.message ?: "")))
                setStatus("Core error: ${e.message}")
            }
        }
    }

    private fun showConfirm(parse: ParseResponse) {
        val lines = parse.commands.joinToString("\n") { cmd ->
            val target = cmd.target.label ?: cmd.target.nodeId ?: "?"
            val value = cmd.value?.let { " = $it" } ?: ""
            "${cmd.action.wireName()} $target$value" +
                if (cmd.confirmRequired) "  [confirm]" else ""
        }
        AlertDialog.Builder(service)
            .setTitle(service.getString(R.string.overlay_title))
            .setMessage(lines)
            .setPositiveButton(service.getString(R.string.confirm)) { _, _ ->
                runExecute(pendingCommands)
            }
            .setNegativeButton(service.getString(R.string.cancel)) { _, _ ->
                setStatus("Cancelled")
                pendingCommands = emptyList()
            }
            .show()
    }

    private fun showClarification(parse: ParseResponse) {
        AlertDialog.Builder(service)
            .setMessage(parse.clarificationQuestion ?: "Which one did you mean?")
            .setPositiveButton(service.getString(R.string.clarify)) { _, _ ->
                // MVP: re-open mic for the answer
                setStatus("Answer with the mic…")
                (root?.findViewById<Button>(R.id.mic))?.performClick()
            }
            .setNegativeButton(service.getString(R.string.cancel), null)
            .show()
        setStatus(parse.clarificationQuestion ?: "Clarification needed")
    }

    private fun runExecute(commands: List<Command>) {
        val result: ExecutionResult = service.runExecute(commands)
        when (result.status) {
            ExecutionResult.Status.OK ->
                setStatus("Executed ${result.executed.size} command(s)")
            ExecutionResult.Status.AMBIGUITY -> {
                val labels = result.candidates.joinToString(", ") {
                    it.displayLabel ?: it.label
                }
                setStatus("Ambiguous: $labels — refine voice command")
            }
            ExecutionResult.Status.ERROR ->
                setStatus("Error: ${result.error}")
        }
        Log.i(
            "overlay",
            "execute",
            mapOf(
                "status" to result.status.wireName(),
                "executed" to result.executed.size,
            ),
        )
    }

    private fun setStatus(text: String) {
        statusView?.text = text
        Log.d("overlay", text)
    }
}
