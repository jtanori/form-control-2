package com.voiceform.network

import com.voiceform.model.FormSnapshot
import com.voiceform.model.NodeAction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreClientTest {

    private val parseJson = """
        {
          "sessionId": "a-dev-abc",
          "commands": [
            {"action":"fill","target":{"label":"email address","nodeId":"a1"},"value":"a@b.com"},
            {"action":"click","target":{"label":"submit billing","nodeId":"a2"},"confirmRequired":true}
          ],
          "needsClarification": false,
          "clarificationQuestion": null,
          "model": "rule-v1"
        }
    """.trimIndent()

    private val clarifyJson = """
        {
          "sessionId": "a-dev-abc",
          "commands": [],
          "needsClarification": true,
          "clarificationQuestion": "Which submit button do you mean?",
          "clarification": {
            "sessionId": "a-dev-abc",
            "question": "Which submit button do you mean?",
            "candidates": [
              {"nodeId":"a2","label":"submit billing"},
              {"nodeId":"a3","label":"submit shipping"}
            ]
          }
        }
    """.trimIndent()

    private fun client(handler: (String, String, String?) -> CoreClient.HttpResult) =
        CoreClient(baseUrl = "http://test", http = handler)

    private fun emptySnapshot() = FormSnapshot(
        capturedAt = "2026-01-15T10:00:00Z",
        title = "Checkout",
        nodes = emptyList(),
    )

    @Test
    fun `parse posts contract body and returns commands`() {
        var seenUrl = ""
        var seenBody: String? = null
        val client = client { url, _, body ->
            seenUrl = url
            seenBody = body
            CoreClient.HttpResult(200, parseJson)
        }
        val result = client.parse("fill the email address with a@b.com", emptySnapshot(), "sess-1")
        assertEquals("http://test/api/v1/parse", seenUrl)
        val body = seenBody.orEmpty()
        assertTrue(body.contains("\"sessionId\":\"sess-1\""))
        assertTrue(body.contains("\"transcript\":"))
        assertTrue(body.contains("\"context\":"))
        assertEquals(2, result.commands.size)
        assertEquals(NodeAction.FILL, result.commands[0].action)
        assertEquals("a1", result.commands[0].target.nodeId)
        assertEquals("a@b.com", result.commands[0].value)
        assertTrue(result.commands[1].confirmRequired)
        assertEquals(false, result.needsClarification)
        assertEquals("rule-v1", result.model)
    }

    @Test
    fun `parse surfaces clarification candidates`() {
        val client = client { _, _, _ -> CoreClient.HttpResult(200, clarifyJson) }
        val result = client.parse("click submit", emptySnapshot())
        assertTrue(result.needsClarification)
        assertEquals("Which submit button do you mean?", result.clarificationQuestion)
        assertEquals(listOf("a2", "a3"), result.clarificationCandidates)
        assertTrue(result.commands.isEmpty())
    }

    @Test
    fun `clarify 409 raises with session message`() {
        val client = client { _, _, _ -> CoreClient.HttpResult(409, """{"detail":"no pending"}""") }
        try {
            client.clarify("billing", "sess-1")
            throw AssertionError("expected IOException")
        } catch (e: Exception) {
            assertTrue(e.message!!.contains("no pending clarification"))
        }
    }

    @Test
    fun `http error on parse throws with status`() {
        val client = client { _, _, _ -> CoreClient.HttpResult(422, """{"detail":"bad"}""") }
        try {
            client.parse("x", emptySnapshot())
            throw AssertionError("expected IOException")
        } catch (e: Exception) {
            assertTrue(e.message!!.contains("422"))
        }
    }

    @Test
    fun `sessionId stable within a window and changes across windows`() {
        val client = client { _, _, _ -> CoreClient.HttpResult(200, parseJson) }
        val first = client.sessionIdForWindow("com.shop/.CheckoutActivity")
        val again = client.sessionIdForWindow("com.shop/.CheckoutActivity")
        assertEquals(first, again)
        val other = client.sessionIdForWindow("com.other/.FormActivity")
        assertNotEquals(first, other)
        assertTrue(first.startsWith("a-"))
    }

    @Test
    fun `parseResponse handles escaped strings`() {
        val json = """{"sessionId":"s","commands":[{"action":"fill","target":{"label":"email"},"value":"a\"b\\c"}],"needsClarification":false,"clarificationQuestion":null}"""
        val result = CoreClient("http://t").parseResponse(json)
        assertEquals("a\"b\\c", result.commands[0].value)
    }
}
