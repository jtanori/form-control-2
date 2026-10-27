package com.voiceform.model

// Contracts v1 mirrors (see contracts/v1 JSON schemas).

data class Rect(val x: Int, val y: Int, val w: Int, val h: Int)

enum class NodeType { INPUT, BUTTON, CHECKBOX, SELECT, LINK;

    fun wireName(): String = name.lowercase()
}

enum class NodeAction {
    FILL, CLICK, CHECK, UNCHECK, NAVIGATE, CLEAR;

    fun wireName(): String = name.lowercase()

    companion object {
        fun fromWire(value: String): NodeAction? =
            entries.firstOrNull { it.wireName() == value }
    }
}

data class FormNode(
    val nodeId: String,
    val label: String,
    val displayLabel: String? = null,
    val type: NodeType,
    val value: String? = null,
    val checked: Boolean? = null,
    val rect: Rect,
    val offscreen: Boolean = false,
    val role: String? = null,
    val source: String = "accessibility",
    val actions: List<NodeAction>,
) {
    fun toJson(): String = buildString {
        append('{')
        append("\"nodeId\":${jsonString(nodeId)}")
        append(",\"label\":${jsonString(label)}")
        displayLabel?.let { append(",\"displayLabel\":${jsonString(it)}") }
        append(",\"type\":${jsonString(type.wireName())}")
        value?.let { append(",\"value\":${jsonString(it)}") }
        checked?.let { append(",\"checked\":$it") }
        append(",\"rect\":{\"x\":${rect.x},\"y\":${rect.y},\"w\":${rect.w},\"h\":${rect.h}}")
        if (offscreen) append(",\"offscreen\":true")
        role?.let { append(",\"role\":${jsonString(it)}") }
        append(",\"source\":${jsonString(source)}")
        append(",\"actions\":[")
        append(actions.joinToString(",") { jsonString(it.wireName()) })
        append("]}")
    }
}

data class FormSnapshot(
    val sessionId: String? = null,
    val source: String = "accessibility",
    val capturedAt: String,
    val title: String,
    val url: String? = null,
    val nodes: List<FormNode>,
) {
    fun toJson(): String = buildString {
        append('{')
        sessionId?.let { append("\"sessionId\":${jsonString(it)},") }
        append("\"source\":${jsonString(source)}")
        append(",\"capturedAt\":${jsonString(capturedAt)}")
        append(",\"title\":${jsonString(title)}")
        url?.let { append(",\"url\":${jsonString(it)}") }
        append(",\"nodes\":[")
        append(nodes.joinToString(",") { it.toJson() })
        append("]}")
    }
}

data class CommandTarget(
    val label: String? = null,
    val nodeId: String? = null,
    val index: Int? = null,
) {
    fun toJson(): String = buildString {
        append('{')
        val parts = mutableListOf<String>()
        label?.let { parts += "\"label\":${jsonString(it)}" }
        nodeId?.let { parts += "\"nodeId\":${jsonString(it)}" }
        index?.let { parts += "\"index\":$it" }
        append(parts.joinToString(","))
        append('}')
    }
}

data class Command(
    val action: NodeAction,
    val target: CommandTarget,
    val value: String? = null,
    val confirmRequired: Boolean = false,
)

data class ExecutionResult(
    val status: Status,
    val executed: List<Command>,
    val candidates: List<FormNode> = emptyList(),
    val error: String? = null,
) {
    enum class Status { OK, AMBIGUITY, ERROR;

        fun wireName(): String = name.lowercase()
    }
}

data class ParseResponse(
    val sessionId: String,
    val commands: List<Command>,
    val needsClarification: Boolean,
    val clarificationQuestion: String?,
    val clarificationCandidates: List<String> = emptyList(),
    val model: String? = null,
)

internal fun jsonString(value: String): String {
    val escaped = buildString {
        for (ch in value) {
            when (ch) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                '\u0008' -> append("\\b")
                '\u000C' -> append("\\f")
                else -> if (ch < ' ') append("\\u%04x".format(ch.code)) else append(ch)
            }
        }
    }
    return "\"$escaped\""
}
