package com.voiceform

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.graphics.Rect
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.voiceform.executor.ActionExecutor
import com.voiceform.model.Command
import com.voiceform.model.ExecutionResult
import com.voiceform.model.FormSnapshot
import com.voiceform.network.CoreClient
import com.voiceform.parser.AndroidA11yNode
import com.voiceform.parser.FieldTargetResolver
import com.voiceform.parser.NodeParser
import com.voiceform.ui.OverlayVoice

/**
 * AND-001 host: AccessibilityService that owns the active window tree and
 * wires AND-002 parser + AND-003 executor + AND-004 overlay.
 */
class VoiceFormService : AccessibilityService() {

    private var overlay: OverlayVoice? = null
    private var consumeBackKeyUp = false

    private var lastBound: NodeParser.BoundSnapshot? = null

    private val executor = ActionExecutor { formNode ->
        lastBound?.byNodeId?.get(formNode.nodeId)?.live
    }

    val coreClient: CoreClient by lazy {
        CoreClient(baseUrl = CoreSettings.baseUrl(this))
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        serviceInfo = serviceInfo?.apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = flags or
                AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS
            notificationTimeout = 100
        }
        Log.i("service", "VoiceForm accessibility service connected")
        overlay = OverlayVoice(this).also { it.show() }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_VIEW_CLICKED) return
        if (event.packageName?.toString() == packageName) return
        val source = event.source ?: return
        val className = source.className?.toString()?.lowercase().orEmpty()
        val isValueControl = source.isEditable || source.isCheckable ||
            className.contains("spinner") || className.contains("dropdown")
        if (!isValueControl) return

        val tappedBounds = Rect()
        source.getBoundsInScreen(tappedBounds)
        if (tappedBounds.isEmpty) return
        val snapshot = currentSnapshot() ?: return
        // Never read EditText text here: it is the user's value, not a label.
        val sourceLabel = source.contentDescription?.toString()
            ?: source.viewIdResourceName
        val target = FieldTargetResolver.resolveTappedField(
            nodes = snapshot.nodes,
            sourceLabel = sourceLabel,
            centerX = tappedBounds.centerX(),
            centerY = tappedBounds.centerY(),
        ) ?: return
        overlay?.onFormFieldTapped(target)
    }

    override fun onInterrupt() {
        overlay?.onServiceInterrupted()
    }

    /** Back is cancellation/navigation only; the overlay never consumes it as approval. */
    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_BACK) return false
        return when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                if (event.repeatCount == 0) {
                    consumeBackKeyUp = overlay?.willHandleBack() == true
                }
                consumeBackKeyUp
            }
            KeyEvent.ACTION_UP -> {
                val consume = consumeBackKeyUp
                consumeBackKeyUp = false
                if (consume) overlay?.handleBack()
                consume
            }
            else -> false
        }
    }

    override fun onDestroy() {
        overlay?.hide()
        overlay = null
        super.onDestroy()
    }

    /** AND-002 entry: snapshot of the active window (also refreshes live bindings). */
    fun currentSnapshot(): FormSnapshot? = currentBound()?.snapshot

    private fun currentBound(): NodeParser.BoundSnapshot? {
        val root: AccessibilityNodeInfo = rootInActiveWindow ?: return null
        val title = root.packageName?.toString() ?: "unknown"
        val bound = NodeParser.parseBound(
            AndroidA11yNode.fromRoot(root),
            title = title,
            url = null,
            sessionId = CoreSettings.sessionIdFor(this, windowKey(root)),
        )
        lastBound = bound
        return bound
    }

    /** AND-003 entry: run commands against the live tree. */
    fun executeCommands(commands: List<Command>): ExecutionResult {
        val bound = currentBound()
            ?: return ExecutionResult(
                status = ExecutionResult.Status.ERROR,
                executed = emptyList(),
                error = "no active window",
            )
        return executor.execute(commands, bound.snapshot)
    }

    private fun windowKey(root: AccessibilityNodeInfo): String {
        val pkg = root.packageName?.toString() ?: "?"
        val cls = root.className?.toString() ?: root.toString()
        return "$pkg/$cls"
    }

    fun openSettings() {
        startActivity(Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    fun sessionSnapshot(): FormSnapshot? = currentSnapshot()

    fun runExecute(commands: List<Command>): ExecutionResult = executeCommands(commands)
}
