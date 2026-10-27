package com.voiceform.parser

import com.voiceform.model.FormNode
import com.voiceform.model.FormSnapshot
import com.voiceform.model.NodeAction
import com.voiceform.model.NodeType
import com.voiceform.model.Rect
import java.time.Instant

/**
 * AND-002 — turn an accessibility node tree into a CONTRACT-001 FormSnapshot.
 *
 * Label resolution mirrors EXT-002 where possible, with the Phase-1 lesson for
 * editable fields: on EditText-like nodes `text` is the *value*, so the label
 * prefers contentDescription → humanized viewId → text.
 */
object NodeParser {

    private val EDITABLE = listOf("edittext", "autocompletetextview")
    private val CHECKABLE = listOf("checkbox", "switch", "checkedtextview", "radiobutton", "togglebutton")
    private val SELECT = listOf("spinner", "dropdown")
    private val BUTTONISH = listOf("button", "materialbutton")

    private val TYPE_ACTIONS: Map<NodeType, List<NodeAction>> = mapOf(
        NodeType.INPUT to listOf(NodeAction.FILL, NodeAction.CLEAR),
        NodeType.BUTTON to listOf(NodeAction.CLICK),
        NodeType.CHECKBOX to listOf(NodeAction.CHECK, NodeAction.UNCHECK),
        NodeType.SELECT to listOf(NodeAction.CLICK, NodeAction.FILL),
        NodeType.LINK to listOf(NodeAction.NAVIGATE, NodeAction.CLICK),
    )

    private val TYPE_ROLE: Map<NodeType, String> = mapOf(
        NodeType.INPUT to "textbox",
        NodeType.BUTTON to "button",
        NodeType.CHECKBOX to "checkbox",
        NodeType.SELECT to "combobox",
        NodeType.LINK to "link",
    )

    /** A FormNode paired with the live tree node it came from (AND-003 binding). */
    data class BoundNode(val form: FormNode, val live: A11yNode)

    fun parseWindowNode(
        root: A11yNode?,
        title: String,
        url: String? = null,
        sessionId: String? = null,
        capturedAt: String = Instant.now().toString(),
    ): FormSnapshot = parseBound(root, title, url, sessionId, capturedAt).snapshot

    /** Same walk as [parseWindowNode] but keeps live-node bindings for the executor. */
    fun parseBound(
        root: A11yNode?,
        title: String,
        url: String? = null,
        sessionId: String? = null,
        capturedAt: String = Instant.now().toString(),
    ): BoundSnapshot {
        val bound = mutableListOf<BoundNode>()
        root?.let { walk(it, bound) }
        val snapshot = FormSnapshot(
            sessionId = sessionId,
            source = "accessibility",
            capturedAt = capturedAt,
            title = title,
            url = url,
            nodes = bound.map { it.form },
        )
        return BoundSnapshot(snapshot, bound.associateBy { it.form.nodeId })
    }

    data class BoundSnapshot(
        val snapshot: FormSnapshot,
        val byNodeId: Map<String, BoundNode>,
    )

    private fun walk(node: A11yNode, out: MutableList<BoundNode>) {
        if (node.isVisibleToUser && isInteresting(node)) {
            out += BoundNode(toFormNode(node, out.size + 1), node)
        }
        for (i in 0 until node.childCount) {
            node.childAt(i)?.let { walk(it, out) }
        }
    }

    /** Skip images without text and pure decorative containers. */
    private fun isInteresting(node: A11yNode): Boolean {
        val cls = node.className?.lowercase() ?: ""
        if (cls.contains("imageview") || cls.contains("image") || cls.contains("img")) {
            // className fallback must not make a decorative image "labelled"
            val explicitLabel = !node.text.isNullOrBlank() ||
                !node.contentDescription.isNullOrBlank() ||
                !node.viewIdResourceName.isNullOrBlank()
            return explicitLabel || node.isClickable
        }
        val hasLabel = !resolveLabel(node).isNullOrBlank()
        if (node.isEditable || node.isClickable || node.isCheckable) return true
        if (hasLabel && (cls.contains("button") || cls.contains("textview"))) return true
        if (node.text.isNullOrBlank() && node.contentDescription.isNullOrBlank()) return false
        // keep labelled static text only when it looks like a form caption
        return hasLabel && outDepthTriggersLabel(node)
    }

    private fun outDepthTriggersLabel(node: A11yNode): Boolean {
        val cls = node.className?.lowercase() ?: ""
        return cls.isBlank() || cls.contains("textinput") || cls.contains("textview")
    }

    private fun resolveLabel(node: A11yNode): String? {
        if (node.isEditable || node.className?.contains("EditText", true) == true) {
            return node.contentDescription?.takeIf { it.isNotBlank() }
                ?: node.viewIdResourceName?.let { humanizeViewId(it) }
                ?: node.text?.takeIf { it.isNotBlank() }
        }
        return node.text?.takeIf { it.isNotBlank() }
            ?: node.contentDescription?.takeIf { it.isNotBlank() }
            ?: node.viewIdResourceName?.let { humanizeViewId(it) }
            ?: node.className?.substringAfterLast('.')?.takeIf { it.isNotBlank() }
    }

    internal fun humanizeViewId(viewId: String): String {
        val tail = viewId.substringAfterLast('/').substringAfterLast('.')
        val spaced = tail.replace(Regex("([a-z0-9])([A-Z])"), "$1 $2")
            .replace('_', ' ')
            .replace('-', ' ')
            .trim()
        return spaced.lowercase().replace(Regex("\\s+"), " ").ifBlank { viewId }
    }

    internal fun inferType(node: A11yNode): NodeType {
        val cls = node.className?.lowercase() ?: return when {
            node.isCheckable -> NodeType.CHECKBOX
            node.isEditable -> NodeType.INPUT
            node.isClickable -> NodeType.BUTTON
            else -> NodeType.INPUT
        }
        return when {
            EDITABLE.any { cls.contains(it) } -> NodeType.INPUT
            CHECKABLE.any { cls.contains(it) } || node.isCheckable -> NodeType.CHECKBOX
            SELECT.any { cls.contains(it) } -> NodeType.SELECT
            BUTTONISH.any { cls.contains(it) } -> NodeType.BUTTON
            cls.contains("button") -> NodeType.BUTTON
            node.isClickable && cls.contains("textview") -> NodeType.BUTTON
            node.isClickable -> NodeType.BUTTON
            node.isEditable -> NodeType.INPUT
            cls.contains("textview") -> NodeType.LINK
            else -> NodeType.INPUT
        }
    }

    private fun toFormNode(node: A11yNode, index: Int): FormNode {
        val type = inferType(node)
        val labelRaw = resolveLabel(node) ?: ""
        val label = normalizeLabel(labelRaw)
        val value = when {
            type == NodeType.INPUT && !node.text.isNullOrBlank() -> node.text
            type == NodeType.SELECT -> null
            else -> null
        }
        val w = (node.boundsRight - node.boundsLeft).coerceAtLeast(0)
        val h = (node.boundsBottom - node.boundsTop).coerceAtLeast(0)
        val offscreen = w == 0 && h == 0
        return FormNode(
            nodeId = "a$index",
            label = label,
            displayLabel = labelRaw.trim().ifBlank { null },
            type = type,
            value = value,
            checked = if (type == NodeType.CHECKBOX) node.isChecked else null,
            rect = Rect(
                x = node.boundsLeft.coerceAtLeast(0),
                y = node.boundsTop.coerceAtLeast(0),
                w = w,
                h = h,
            ),
            offscreen = offscreen,
            role = TYPE_ROLE[type],
            source = "accessibility",
            actions = TYPE_ACTIONS.getValue(type),
        )
    }

    internal fun normalizeLabel(raw: String): String =
        raw.lowercase()
            .replace(Regex("[\\p{Pd}\\p{P}]"), " ")
            .trim()
            .replace(Regex("\\s+"), " ")
}
