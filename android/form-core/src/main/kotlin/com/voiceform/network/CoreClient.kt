package com.voiceform.network

import com.voiceform.model.Command
import com.voiceform.model.CommandTarget
import com.voiceform.model.FormSnapshot
import com.voiceform.model.NodeAction
import com.voiceform.model.ParseResponse
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * AND-005 — HTTP client for Core `/api/v1/parse` and `/api/v1/clarify`.
 *
 * Session identity (MVP, provisional — see INTE-002):
 *   sessionId = "a-" + deviceId + "-" + windowHash
 * Stable while the same window stays active; changes when the window changes.
 */
class CoreClient(
    private val baseUrl: String = "http://localhost:8020",
    private val deviceId: String = "dev",
    private val connectTimeoutMs: Int = 5_000,
    private val readTimeoutMs: Int = 15_000,
    private val http: (String, String, String?) -> HttpResult = ::defaultHttp,
) {
    data class HttpResult(val status: Int, val body: String)

    private var lastWindowHash: String = ""
    private var currentSessionId: String = newSession("init")

    fun sessionIdForWindow(windowKey: String): String {
        val hash = Integer.toHexString(windowKey.hashCode())
        if (hash != lastWindowHash) {
            lastWindowHash = hash
            currentSessionId = newSession(hash)
        }
        return currentSessionId
    }

    private fun newSession(windowHash: String): String =
        "a-$deviceId-$windowHash-${UUID.randomUUID().toString().take(8)}"

    fun parse(transcript: String, context: FormSnapshot, sessionId: String? = null): ParseResponse {
        val sid = sessionId ?: currentSessionId
        val body = buildString {
            append('{')
            append("\"sessionId\":${jsonStr(sid)}")
            append(",\"transcript\":${jsonStr(transcript)}")
            append(",\"context\":${context.toJson()}")
            append('}')
        }
        val result = http("$baseUrl/api/v1/parse", "POST", body)
        if (result.status !in 200..299) {
            throw IOException("core parse -> HTTP ${result.status}: ${result.body.take(200)}")
        }
        return parseResponse(result.body)
    }

    fun clarify(text: String, sessionId: String? = null): ParseResponse {
        val sid = sessionId ?: currentSessionId
        val body = buildString {
            append('{')
            append("\"sessionId\":${jsonStr(sid)}")
            append(",\"clarificationText\":${jsonStr(text)}")
            append('}')
        }
        val result = http("$baseUrl/api/v1/clarify", "POST", body)
        if (result.status == 409) {
            throw IOException("no pending clarification for session $sid")
        }
        if (result.status !in 200..299) {
            throw IOException("core clarify -> HTTP ${result.status}: ${result.body.take(200)}")
        }
        return parseResponse(result.body)
    }

    fun health(): Boolean = try {
        http("$baseUrl/api/v1/health", "GET", null).status == 200
    } catch (_: Exception) {
        false
    }

    // ---- minimal JSON extraction (no external deps on Android/JVM) ----

    internal fun parseResponse(json: String): ParseResponse {
        val sid = extractString(json, "sessionId") ?: ""
        val needs = extractBool(json, "needsClarification") ?: false
        val question = extractString(json, "clarificationQuestion")
        val model = extractString(json, "model")
        val commands = mutableListOf<Command>()
        val commandsArr = extractArray(json, "commands") ?: ""
        for (obj in splitObjects(commandsArr)) {
            val action = extractString(obj, "action")?.let { NodeAction.fromWire(it) } ?: continue
            val targetObj = extractObject(obj, "target") ?: continue
            val target = CommandTarget(
                label = extractString(targetObj, "label"),
                nodeId = extractString(targetObj, "nodeId"),
                index = extractInt(targetObj, "index"),
            )
            commands += Command(
                action = action,
                target = target,
                value = extractString(obj, "value"),
                confirmRequired = extractBool(obj, "confirmRequired") ?: false,
            )
        }
        val candidates = mutableListOf<String>()
        val clarification = extractObject(json, "clarification")
        if (clarification != null) {
            val cands = extractArray(clarification, "candidates") ?: ""
            for (node in splitObjects(cands)) {
                extractString(node, "nodeId")?.let { candidates += it }
            }
        }
        return ParseResponse(
            sessionId = sid,
            commands = commands,
            needsClarification = needs,
            clarificationQuestion = question,
            clarificationCandidates = candidates,
            model = model,
        )
    }

    companion object {
        fun defaultHttp(url: String, method: String, body: String?): HttpResult {
            val conn = URL(url).openConnection() as HttpURLConnection
            try {
                conn.requestMethod = method
                conn.connectTimeout = 5_000
                conn.readTimeout = 15_000
                if (body != null) {
                    conn.doOutput = true
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                }
                val status = conn.responseCode
                val stream = if (status >= 400) conn.errorStream else conn.inputStream
                val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
                return HttpResult(status, text)
            } finally {
                conn.disconnect()
            }
        }

        internal fun jsonStr(value: String): String {
            val escaped = buildString {
                for (ch in value) {
                    when (ch) {
                        '\\' -> append("\\\\")
                        '"' -> append("\\\"")
                        '\n' -> append("\\n")
                        '\r' -> append("\\r")
                        '\t' -> append("\\t")
                        else -> if (ch < ' ') append("\\u%04x".format(ch.code)) else append(ch)
                    }
                }
            }
            return "\"$escaped\""
        }

        internal fun extractString(json: String, key: String): String? {
            val pattern = Regex("\"$key\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"")
            val m = pattern.find(json) ?: return null
            return unescape(m.groupValues[1])
        }

        internal fun extractBool(json: String, key: String): Boolean? {
            val m = Regex("\"$key\"\\s*:\\s*(true|false)").find(json) ?: return null
            return m.groupValues[1] == "true"
        }

        internal fun extractInt(json: String, key: String): Int? {
            val m = Regex("\"$key\"\\s*:\\s*(-?\\d+)").find(json) ?: return null
            return m.groupValues[1].toIntOrNull()
        }

        internal fun extractObject(json: String, key: String): String? {
            val start = Regex("\"$key\"\\s*:\\s*\\{").find(json)?.range?.last ?: return null
            var depth = 1
            var i = start + 1
            while (i < json.length && depth > 0) {
                when (json[i]) {
                    '{' -> depth++
                    '}' -> depth--
                }
                i++
            }
            return json.substring(start, i)
        }

        internal fun extractArray(json: String, key: String): String? {
            val m = Regex("\"$key\"\\s*:\\s*\\[").find(json) ?: return null
            val start = m.range.last
            var depth = 1
            var i = start + 1
            while (i < json.length && depth > 0) {
                when (json[i]) {
                    '[' -> depth++
                    ']' -> depth--
                }
                i++
            }
            return json.substring(start + 1, i - 1)
        }

        internal fun splitObjects(arrayBody: String): List<String> {
            val out = mutableListOf<String>()
            var depth = 0
            var start = -1
            for ((i, ch) in arrayBody.withIndex()) {
                when (ch) {
                    '{' -> {
                        if (depth == 0) start = i
                        depth++
                    }
                    '}' -> {
                        depth--
                        if (depth == 0 && start >= 0) {
                            out += arrayBody.substring(start, i + 1)
                            start = -1
                        }
                    }
                }
            }
            return out
        }

        private fun unescape(s: String): String = buildString {
            var i = 0
            while (i < s.length) {
                val ch = s[i]
                if (ch == '\\' && i + 1 < s.length) {
                    when (s[i + 1]) {
                        'n' -> append('\n')
                        'r' -> append('\r')
                        't' -> append('\t')
                        'u' -> {
                            val hex = s.substring(i + 2, minOf(i + 6, s.length))
                            hex.toIntOrNull(16)?.let { append(it.toChar()) }
                            i += 4
                        }
                        else -> append(s[i + 1])
                    }
                    i += 2
                } else {
                    append(ch)
                    i++
                }
            }
        }
    }
}
