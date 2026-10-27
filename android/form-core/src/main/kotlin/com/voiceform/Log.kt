package com.voiceform

/**
 * INFR-002 — structured JSON logger (same shape as core/extensions).
 */
object Log {
    @Volatile
    var sessionId: String? = null

    fun d(component: String, message: String, extra: Map<String, Any?> = emptyMap()) =
        emit("debug", component, message, extra)

    fun i(component: String, message: String, extra: Map<String, Any?> = emptyMap()) =
        emit("info", component, message, extra)

    fun w(component: String, message: String, extra: Map<String, Any?> = emptyMap()) =
        emit("warn", component, message, extra)

    fun e(component: String, message: String, extra: Map<String, Any?> = emptyMap()) =
        emit("error", component, message, extra)

    private fun emit(
        level: String,
        component: String,
        message: String,
        extra: Map<String, Any?>,
    ) {
        val payload = buildString {
            append("{\"ts\":\"")
            append(java.time.Instant.now().toString())
            append("\",\"level\":\"").append(level)
            append("\",\"component\":").append(quote(component))
            append(",\"sessionId\":")
            sessionId?.let { append(quote(it)) } ?: append("null")
            append(",\"message\":").append(quote(message))
            for ((k, v) in extra) {
                append(',').append(quote(k)).append(':')
                append(
                    when (v) {
                        null -> "null"
                        is Number, is Boolean -> v.toString()
                        else -> quote(v.toString())
                    },
                )
            }
            append('}')
        }
        println(payload)
    }

    private fun quote(s: String): String = buildString {
        append('"')
        for (ch in s) {
            when (ch) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                else -> append(ch)
            }
        }
        append('"')
    }
}
