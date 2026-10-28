package com.voiceform.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
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
import com.voiceform.model.isRisky
import com.voiceform.voice.VoiceClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * AND-006 (spec §6.6/6.7) — overlay state machine:
 *
 *   COLLAPSED (FAB + field badge)
 *     └ tap FAB → EXPANDED_IDLE
 *   EXPANDED_IDLE ─ start → LISTENING ─ result → PARSING
 *        ▲                               ├ risky → REVIEWING (pill) ─ confirm → execute
 *        └──── cancel / done ◄────────── └ ordinary → execute directly (§3.2 FSM)
 *
 * Confirm pill: visible countdown **text**, button always enabled (D1 — ungated).
 * Close precedence (§8.3 spirit): pill cancel beats dismiss.
 * No AlertDialogs — all feedback lives inside the overlay (§6.7).
 */
class OverlayVoice(private val service: VoiceFormService) {

    private enum class State { COLLAPSED, IDLE, LISTENING, PARSING, REVIEWING }

    private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private var root: LinearLayout? = null
    private var collapsed: LinearLayout? = null
    private var expanded: LinearLayout? = null
    private var fab: Button? = null
    private var badge: TextView? = null
    private var header: TextView? = null
    private var statusView: TextView? = null
    private var transcriptView: TextView? = null
    private var listeningRow: LinearLayout? = null
    private var reviewRow: LinearLayout? = null
    private var reviewTitle: TextView? = null
    private var reviewCommands: TextView? = null
    private var reviewConfirm: Button? = null
    private var primary: Button? = null

    private var voice: VoiceClient? = null
    private var pendingCommands: List<Command> = emptyList()
    private var state: State = State.COLLAPSED

    private var countdownTick: Runnable? = null
    private var countdownLeft = 0

    private fun getString(id: Int, vararg args: Any): String =
        service.getString(id, *args)

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

        collapsed = view.findViewById(R.id.collapsed)
        expanded = view.findViewById(R.id.expanded)
        fab = view.findViewById(R.id.fab)
        badge = view.findViewById(R.id.badge)
        header = view.findViewById(R.id.header)
        statusView = view.findViewById(R.id.status)
        transcriptView = view.findViewById(R.id.transcript)
        listeningRow = view.findViewById(R.id.listeningRow)
        reviewRow = view.findViewById(R.id.reviewRow)
        reviewTitle = view.findViewById(R.id.reviewTitle)
        reviewCommands = view.findViewById(R.id.reviewCommands)
        reviewConfirm = view.findViewById(R.id.reviewConfirm)
        primary = view.findViewById(R.id.primary)

        fab?.setOnClickListener {
            if (state == State.COLLAPSED) expand()
        }
        // Collapse without dismissing (header tap)
        header?.setOnClickListener {
            if (state == State.IDLE) collapse()
        }
        // §8.3 precedence: cancel pending pill before dismissing
        view.findViewById<Button>(R.id.close).setOnClickListener {
            if (state == State.REVIEWING) cancelReview()
            else hide()
        }
        primary?.setOnClickListener { onPrimary() }
        view.findViewById<Button>(R.id.reviewCancel).setOnClickListener { cancelReview() }
        reviewConfirm?.setOnClickListener { onConfirmed() }

        var lastX = 0
        var lastY = 0
        view.findViewById<View>(R.id.drag).setOnTouchListener { _, event ->
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
            applyState()
            refreshBadge()
            setStatus(service.getString(R.string.overlay_collapsed_hint))
        } catch (e: SecurityException) {
            Log.e("overlay", "overlay permission missing", mapOf("error" to (e.message ?: "")))
            Toast.makeText(service, getString(R.string.overlay_permission), Toast.LENGTH_LONG)
                .show()
        }
    }

    fun hide() {
        stopListening(silent = true)
        cancelCountdown()
        pendingCommands = emptyList() // §6.7: dismissal invalidates pending auth
        root?.let { runCatching { wm.removeView(it) } }
        root = null
        collapsed = null
        expanded = null
        fab = null
        badge = null
        header = null
        statusView = null
        transcriptView = null
        listeningRow = null
        reviewRow = null
        reviewTitle = null
        reviewCommands = null
        reviewConfirm = null
        primary = null
        state = State.COLLAPSED
    }

    private fun expand() {
        state = State.IDLE
        applyState()
        refreshBadge()
        setStatus(service.getString(R.string.voice_start))
    }

    private fun collapse() {
        if (state != State.IDLE) return
        state = State.COLLAPSED
        applyState()
    }

    private fun applyState() {
        val isCollapsed = state == State.COLLAPSED
        collapsed?.visibility = if (isCollapsed) View.VISIBLE else View.GONE
        expanded?.visibility = if (isCollapsed) View.GONE else View.VISIBLE

        listeningRow?.visibility =
            if (state == State.LISTENING) View.VISIBLE else View.GONE
        reviewRow?.visibility =
            if (state == State.REVIEWING) View.VISIBLE else View.GONE

        primary?.visibility =
            if (state == State.REVIEWING) View.GONE else View.VISIBLE
        primary?.isEnabled = state == State.IDLE || state == State.LISTENING
        primary?.text =
            when (state) {
                State.LISTENING -> getString(R.string.voice_stop)
                State.PARSING -> getString(R.string.voice_parsing)
                else -> getString(R.string.voice_start)
            }
    }

    private fun refreshBadge() {
        val count = service.sessionSnapshot()?.nodes?.size ?: 0
        badge?.visibility = View.VISIBLE
        badge?.text = service.resources.getQuantityString(
            R.plurals.field_count,
            count,
            count,
        )
        header?.text =
            if (count > 0) "${getString(R.string.overlay_title)} · $count fields"
            else getString(R.string.overlay_title)
    }

    private fun onPrimary() {
        when (state) {
            State.IDLE -> startListening()
            State.LISTENING -> stopListening(silent = false)
            State.PARSING -> Unit // busy
            State.REVIEWING -> Unit // confirm row owns this state
            State.COLLAPSED -> expand()
        }
    }

    private fun startListening() {
        state = State.LISTENING
        applyState()
        transcriptView?.visibility = View.GONE
        setStatus(getString(R.string.voice_start))
        voice = VoiceClient(
            service,
            onResult = { transcript ->
                main.post {
                    voice = null
                    onTranscript(transcript)
                }
            },
            onError = { err ->
                main.post {
                    voice = null
                    state = State.IDLE
                    applyState()
                    setStatus(err)
                }
            },
        )
        voice?.startListening()
    }

    private fun stopListening(silent: Boolean) {
        voice?.stop()
        voice = null
        if (!silent && state == State.LISTENING) {
            state = State.IDLE
            applyState()
            setStatus(getString(R.string.voice_cancelled))
        }
    }

    private fun onTranscript(transcript: String) {
        state = State.PARSING
        applyState()
        transcriptView?.visibility = View.VISIBLE
        transcriptView?.text = transcript
        setStatus(getString(R.string.voice_parsing))
        val snapshot = service.sessionSnapshot()
        if (snapshot == null) {
            state = State.IDLE
            applyState()
            setStatus(getString(R.string.error_no_match))
            return
        }
        Log.i("overlay", "parse", mapOf("transcriptLength" to transcript.length))
        scope.launch {
            try {
                val client = CoreSettings.newClient(service)
                val result = withContext(Dispatchers.IO) {
                    client.parse(transcript, snapshot, snapshot.sessionId)
                }
                withContext(Dispatchers.Main) { onParsed(result) }
            } catch (e: Exception) {
                Log.e("overlay", "parse failed", mapOf("error" to (e.message ?: "")))
                state = State.IDLE
                applyState()
                setStatus(getString(R.string.error_core) + " (${e.message})")
            }
        }
    }

    private fun onParsed(result: ParseResponse) {
        when {
            result.needsClarification -> {
                state = State.IDLE
                applyState()
                setStatus(result.clarificationQuestion ?: getString(R.string.error_ambiguous))
            }
            result.commands.isEmpty() -> {
                state = State.IDLE
                applyState()
                setStatus(getString(R.string.error_no_match))
            }
            isRisky(result.commands) -> {
                // §3.2: consequential → CONFIRM_GATE (visible, ungated per D1)
                pendingCommands = result.commands
                state = State.REVIEWING
                applyState()
                reviewTitle?.text = getString(R.string.confirm_submit)
                reviewCommands?.text = result.commands.joinToString("\n") { cmd ->
                    val target = cmd.target.label ?: cmd.target.nodeId ?: "?"
                    val value = cmd.value?.let { " = $it" } ?: ""
                    "${cmd.action.wireName()} $target$value"
                }
                startCountdown()
                setStatus(service.getString(R.string.confirm))
            }
            else -> {
                // §3.2: ordinary field edits execute immediately
                pendingCommands = result.commands
                runExecute(pendingCommands)
                state = State.IDLE
                applyState()
            }
        }
    }

    private fun startCountdown() {
        cancelCountdown()
        countdownLeft = 3
        reviewConfirm?.isEnabled = true // D1: never gated
        reviewConfirm?.text =
            service.getString(R.string.confirm_countdown, countdownLeft)
        val tick = object : Runnable {
            override fun run() {
                if (state != State.REVIEWING) return
                countdownLeft -= 1
                reviewConfirm?.text =
                    if (countdownLeft > 0) {
                        service.getString(R.string.confirm_countdown, countdownLeft)
                    } else {
                        service.getString(R.string.confirm)
                    }
                if (countdownLeft > 0) {
                    main.postDelayed(this, 1000)
                }
            }
        }
        countdownTick = tick
        main.postDelayed(tick, 1000)
    }

    private fun cancelCountdown() {
        countdownTick?.let { main.removeCallbacks(it) }
        countdownTick = null
    }

    private fun onConfirmed() {
        cancelCountdown()
        val commands = pendingCommands
        pendingCommands = emptyList()
        state = State.IDLE
        applyState()
        runExecute(commands)
    }

    private fun cancelReview() {
        cancelCountdown()
        pendingCommands = emptyList()
        state = State.IDLE
        applyState()
        setStatus(getString(R.string.confirm_cancelled))
    }

    private fun runExecute(commands: List<Command>) {
        val result: ExecutionResult = service.runExecute(commands)
        when (result.status) {
            ExecutionResult.Status.OK ->
                setStatus(
                    service.resources.getQuantityString(
                        R.plurals.success_count,
                        result.executed.size,
                        result.executed.size,
                    ),
                )
            ExecutionResult.Status.AMBIGUITY -> {
                val labels = result.candidates.joinToString(", ") {
                    it.displayLabel ?: it.label
                }
                setStatus("${getString(R.string.error_ambiguous)} ($labels)")
            }
            ExecutionResult.Status.ERROR ->
                setStatus(getString(R.string.error_execution) + " (${result.error})")
        }
        Log.i(
            "overlay",
            "execute",
            mapOf(
                "status" to result.status.wireName(),
                "executed" to result.executed.size,
            ),
        )
        refreshBadge()
    }

    private fun setStatus(text: String) {
        statusView?.text = text
        Log.d("overlay", text)
    }
}
