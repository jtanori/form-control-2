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
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import com.voiceform.CoreSettings
import com.voiceform.Log
import com.voiceform.R
import com.voiceform.VoiceFormService
import com.voiceform.model.Command
import com.voiceform.model.CommandTarget
import com.voiceform.model.ExecutionResult
import com.voiceform.model.FormNode
import com.voiceform.model.NodeAction
import com.voiceform.model.NodeType
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

    private companion object {
        const val MAX_FIELD_ROWS = 8
        val SUBMIT_LIKE =
            Regex("(?i)\\b(submit|continue|place order|pay|purchase|checkout|sign in|log in)\\b")
    }

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
    private var fieldList: LinearLayout? = null
    private var fieldListScroll: View? = null
    private var fieldListEmpty: TextView? = null
    private var workspace: LinearLayout? = null
    private var zenPanel: LinearLayout? = null
    private var zenCount: TextView? = null
    private var zenProgress: ProgressBar? = null
    private var zenFieldValue: TextView? = null
    private var zenList: LinearLayout? = null
    private var zenEmpty: TextView? = null
    private var zenFieldRow: LinearLayout? = null
    private var zenSpeak: Button? = null
    private var zenBack: Button? = null
    private var zenNext: Button? = null
    private var zenDismiss: Button? = null
    private var zenReviewMeta: TextView? = null
    private var zenReviewRow: LinearLayout? = null
    private var zenEdit: Button? = null
    private var zenSubmit: Button? = null

    private var zenOpen = false
    private var zenReview = false
    private var zenIndex = 0
    private var zenNodes: List<FormNode> = emptyList()
    private var zenSubmitPending = false // close Zen only after approved submit (P2 parity)

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
        fieldList = view.findViewById(R.id.fieldList)
        fieldListScroll = view.findViewById(R.id.fieldListScroll)
        fieldListEmpty = view.findViewById(R.id.fieldListEmpty)
        workspace = view.findViewById(R.id.workspace)
        zenPanel = view.findViewById(R.id.zenPanel)
        zenCount = view.findViewById(R.id.zenCount)
        zenProgress = view.findViewById(R.id.zenProgress)
        zenFieldValue = view.findViewById(R.id.zenFieldValue)
        zenList = view.findViewById(R.id.zenList)
        zenEmpty = view.findViewById(R.id.zenEmpty)
        zenFieldRow = view.findViewById(R.id.zenFieldRow)
        zenSpeak = view.findViewById(R.id.zenSpeak)
        zenBack = view.findViewById(R.id.zenBack)
        zenNext = view.findViewById(R.id.zenNext)
        zenDismiss = view.findViewById(R.id.zenDismiss)
        zenReviewMeta = view.findViewById(R.id.zenReviewMeta)
        zenReviewRow = view.findViewById(R.id.zenReviewRow)
        zenEdit = view.findViewById(R.id.zenEdit)
        zenSubmit = view.findViewById(R.id.zenSubmit)

        view.findViewById<Button>(R.id.zenOpen).setOnClickListener { openZen() }
        zenSpeak?.setOnClickListener { onZenSpeak() }
        zenBack?.setOnClickListener { stepZen(-1) }
        zenNext?.setOnClickListener { stepZen(1) }
        zenDismiss?.setOnClickListener { closeZen() }
        zenEdit?.setOnClickListener {
            zenReview = false
            paintZen()
        }
        zenSubmit?.setOnClickListener { onZenSubmit() }

        fab?.setOnClickListener {
            if (state == State.COLLAPSED) expand()
        }
        // Collapse without dismissing (header tap) — §8.3 order: Zen → pill → collapse
        header?.setOnClickListener {
            when {
                zenOpen -> closeZen()
                state == State.REVIEWING -> cancelReview()
                state == State.IDLE -> collapse()
            }
        }
        // §8.3 precedence: Zen → pill → collapse → dismiss; never confirms
        view.findViewById<Button>(R.id.close).setOnClickListener {
            when {
                zenOpen -> closeZen()
                state == State.REVIEWING -> cancelReview()
                state == State.COLLAPSED -> hide()
                else -> collapse()
            }
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
            refreshFieldList()
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
        fieldList = null
        fieldListScroll = null
        fieldListEmpty = null
        workspace = null
        zenPanel = null
        zenCount = null
        zenProgress = null
        zenFieldValue = null
        zenList = null
        zenEmpty = null
        zenFieldRow = null
        zenSpeak = null
        zenBack = null
        zenNext = null
        zenDismiss = null
        zenReviewMeta = null
        zenReviewRow = null
        zenEdit = null
        zenSubmit = null
        zenOpen = false
        zenReview = false
        zenSubmitPending = false
        state = State.COLLAPSED
    }

    private fun expand() {
        state = State.IDLE
        applyState()
        refreshBadge()
        refreshFieldList()
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

        // Zen replaces the workspace (§6.4); pill row stays shared above it
        workspace?.visibility =
            if (isCollapsed || zenOpen) View.GONE else View.VISIBLE
        zenPanel?.visibility =
            if (!isCollapsed && zenOpen) View.VISIBLE else View.GONE

        listeningRow?.visibility =
            if (state == State.LISTENING) View.VISIBLE else View.GONE
        reviewRow?.visibility =
            if (state == State.REVIEWING) View.VISIBLE else View.GONE

        primary?.visibility =
            if (state == State.REVIEWING || zenOpen) View.GONE else View.VISIBLE
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

    /** §6.7 field rows: `label → value` for interactive fields (AND-006 list parity). */
    private fun refreshFieldList() {
        val list = fieldList ?: return
        val fields = service.sessionSnapshot()?.nodes
            ?.filter {
                it.type == NodeType.INPUT || it.type == NodeType.CHECKBOX ||
                    it.type == NodeType.SELECT
            }
            ?.filter { it.label.isNotBlank() }
            ?: emptyList()

        list.removeAllViews()
        if (fields.isEmpty()) {
            fieldListScroll?.visibility = View.GONE
            fieldListEmpty?.visibility = View.VISIBLE
            return
        }
        fieldListScroll?.visibility = View.VISIBLE
        fieldListEmpty?.visibility = View.GONE

        val rowLayout = R.layout.overlay_field_row
        for (node in fields.take(MAX_FIELD_ROWS)) {
            val row = LayoutInflater.from(service).inflate(rowLayout, list, false)
            row.findViewById<TextView>(R.id.rowLabel).text =
                node.displayLabel ?: node.label
            row.findViewById<TextView>(R.id.rowValue).text =
                node.value
                    ?: if (node.type == NodeType.CHECKBOX) {
                        if (node.checked == true) "✓" else "☐"
                    } else {
                        "—"
                    }
            list.addView(row)
        }
        if (fields.size > MAX_FIELD_ROWS) {
            val more = TextView(service)
            more.text = getString(R.string.overlay_more_fields, fields.size - MAX_FIELD_ROWS)
            more.setTextColor(service.getColor(R.color.vf_text_tertiary))
            more.textSize = 11f
            more.setPadding(0, 8, 0, 0)
            list.addView(more)
        }
    }

    // ---------- Zen (§6.4 simplified — P2 parity) ----------

    private fun openZen() {
        zenNodes = service.sessionSnapshot()?.nodes
            ?.filter { !it.offscreen && it.label.isNotBlank() }
            ?: emptyList()
        zenOpen = true
        zenReview = false
        zenIndex = 0
        applyState()
        paintZen()
    }

    private fun closeZen() {
        zenOpen = false
        zenReview = false
        zenSubmitPending = false
        stopListening(silent = true) // §8.3.1: dismiss Zen cancels capture
        if (state == State.LISTENING) state = State.IDLE // capture was cancelled
        applyState()
        refreshFieldList()
    }

    private fun stepZen(delta: Int) {
        if (zenNodes.isEmpty()) return
        zenIndex = (zenIndex + delta).coerceIn(0, zenNodes.size - 1)
        if (zenReview && delta != 0) zenReview = false
        paintZen()
    }

    private fun paintZen() {
        val count = zenNodes.size
        zenCount?.text = getString(R.string.zen_count, zenIndex + 1, count)
        zenProgress?.progress =
            if (count == 0) 0
            else if (zenReview) 100
            else ((zenIndex + 1) * 100 / count)

        if (count == 0) {
            zenEmpty?.visibility = View.VISIBLE
            zenFieldRow?.visibility = View.GONE
            zenReviewRow?.visibility = View.GONE
            zenReviewMeta?.visibility = View.GONE
            zenFieldValue?.text = getString(R.string.zen_empty)
            return
        }
        zenEmpty?.visibility = View.GONE

        val list = zenList ?: return
        list.removeAllViews()
        val rowLayout = R.layout.overlay_field_row
        zenNodes.forEachIndexed { i, node ->
            val row = LayoutInflater.from(service).inflate(rowLayout, list, false)
            row.findViewById<TextView>(R.id.rowLabel).text =
                node.displayLabel ?: node.label
            row.findViewById<TextView>(R.id.rowValue).text = nodeDisplayValue(node)
            if (i == zenIndex) row.setBackgroundColor(service.getColor(R.color.vf_accent_soft))
            row.setOnClickListener {
                zenIndex = i
                zenReview = false
                paintZen()
            }
            list.addView(row)
        }

        val current = zenNodes[zenIndex]
        zenFieldValue?.text =
            (current.displayLabel ?: current.label) +
                (current.value?.let { " = $it" } ?: "")

        zenFieldRow?.visibility = if (zenReview) View.GONE else View.VISIBLE
        zenReviewRow?.visibility = if (zenReview) View.VISIBLE else View.GONE
        zenReviewMeta?.visibility = if (zenReview) View.VISIBLE else View.GONE
        zenBack?.isEnabled = zenIndex > 0
        if (zenReview) {
            val submitTarget = zenNodes.firstOrNull {
                it.type == NodeType.BUTTON && SUBMIT_LIKE.containsMatchIn(it.label)
            }
            zenSubmit?.isEnabled = submitTarget != null
            zenSubmit?.text =
                if (submitTarget == null) getString(R.string.zen_no_submit)
                else getString(R.string.zen_submit)
        }
    }

    private fun nodeDisplayValue(node: FormNode): String =
        node.value
            ?: when {
                node.type == NodeType.CHECKBOX ->
                    if (node.checked == true) "✓" else "☐"
                else -> "—"
            }

    private fun onZenSpeak() {
        if (state == State.LISTENING) stopListening(silent = false)
        else if (state == State.IDLE) startListening()
    }

    private fun onZenSubmit() {
        val submitTarget = zenNodes.firstOrNull {
            it.type == NodeType.BUTTON && SUBMIT_LIKE.containsMatchIn(it.label)
        } ?: return
        val command = Command(
            action = NodeAction.CLICK,
            target = CommandTarget(
                nodeId = submitTarget.nodeId,
                label = submitTarget.label,
            ),
        )
        pendingCommands = listOf(command)
        // Zen stays open until the pill is approved (P2 parity); D1 ungated
        zenSubmitPending = true
        state = State.REVIEWING
        applyState()
        reviewTitle?.text = getString(R.string.confirm_submit)
        reviewCommands?.text = submitTarget.label
        startCountdown()
        setStatus(getString(R.string.confirm))
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
        val fromZen = zenSubmitPending
        zenSubmitPending = false
        if (fromZen) zenOpen = false // §6.4: Zen closes only after approved submit
        applyState()
        runExecute(commands)
        if (zenOpen) refreshZenSnapshot()
    }

    private fun cancelReview() {
        cancelCountdown()
        pendingCommands = emptyList()
        zenSubmitPending = false // pill killed → Zen stays open (P2 parity)
        state = State.IDLE
        applyState()
        setStatus(getString(R.string.confirm_cancelled))
    }

    /** Re-pull node values after an execution while Zen is open. */
    private fun refreshZenSnapshot() {
        zenNodes = service.sessionSnapshot()?.nodes
            ?.filter { !it.offscreen && it.label.isNotBlank() }
            ?: emptyList()
        if (zenIndex >= zenNodes.size) zenIndex = (zenNodes.size - 1).coerceAtLeast(0)
        paintZen()
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
        refreshFieldList()
        if (zenOpen) refreshZenSnapshot()
    }

    private fun setStatus(text: String) {
        statusView?.text = text
        Log.d("overlay", text)
    }
}
