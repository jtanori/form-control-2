package com.voiceform.executor

import com.voiceform.model.Command
import com.voiceform.model.CommandTarget
import com.voiceform.model.ExecutionResult
import com.voiceform.model.NodeAction
import com.voiceform.parser.FakeA11yNode
import com.voiceform.parser.NodeParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ActionExecutorTest {

    private val emailField = FakeA11yNode(
        className = "android.widget.EditText",
        contentDescription = "Email address",
        isEditable = true,
        boundsRight = 300, boundsBottom = 40,
    )
    private val submitBilling = FakeA11yNode(
        className = "android.widget.Button",
        text = "Submit billing",
        isClickable = true,
        boundsTop = 100, boundsRight = 140, boundsBottom = 140,
    )
    private val submitShipping = FakeA11yNode(
        className = "android.widget.Button",
        text = "Submit shipping",
        isClickable = true,
        boundsLeft = 160, boundsTop = 100, boundsRight = 300, boundsBottom = 140,
    )
    private val terms = FakeA11yNode(
        className = "android.widget.CheckBox",
        text = "I agree to the terms and conditions",
        isCheckable = true,
        boundsTop = 200, boundsRight = 20, boundsBottom = 220,
    )

    private val live = listOf(emailField, submitBilling, submitShipping, terms)

    private fun tree() = FakeA11yNode(
        className = "android.widget.FrameLayout",
        children = live,
    )

    private val snapshot = NodeParser.parseWindowNode(tree(), title = "Checkout")

    /** Map FormNode → live fake by index order (same traversal). */
    private val executor = ActionExecutor { node ->
        val idx = snapshot.nodes.indexOfFirst { it.nodeId == node.nodeId }
        live.getOrNull(idx)
    }

    @Test
    fun `fills an editable with setText`() {
        val cmd = Command(
            action = NodeAction.FILL,
            target = CommandTarget(nodeId = "a1", label = "email address"),
            value = "a@b.com",
        )
        val result = executor.execute(listOf(cmd), snapshot)
        assertEquals(ExecutionResult.Status.OK, result.status)
        assertTrue(emailField.performed.any { it == "setText:a@b.com" })
    }

    @Test
    fun `clicks a button`() {
        val cmd = Command(action = NodeAction.CLICK, target = CommandTarget(nodeId = "a2"))
        val result = executor.execute(listOf(cmd), snapshot)
        assertEquals(ExecutionResult.Status.OK, result.status)
        assertEquals(listOf("click"), submitBilling.performed.toList())
    }

    @Test
    fun `checks and unchecks`() {
        executor.execute(
            listOf(Command(action = NodeAction.CHECK, target = CommandTarget(nodeId = "a4"))),
            snapshot,
        )
        assertTrue(terms.performed.contains("check"))
        executor.execute(
            listOf(Command(action = NodeAction.UNCHECK, target = CommandTarget(nodeId = "a4"))),
            snapshot,
        )
        assertTrue(terms.performed.contains("uncheck"))
    }

    @Test
    fun `ambiguous submit returns candidates and does not act`() {
        val cmd = Command(action = NodeAction.CLICK, target = CommandTarget(label = "submit"))
        val result = executor.execute(listOf(cmd), snapshot)
        assertEquals(ExecutionResult.Status.AMBIGUITY, result.status)
        assertEquals(2, result.candidates.size)
        assertTrue(submitBilling.performed.isEmpty())
        assertTrue(submitShipping.performed.isEmpty())
        assertTrue(result.executed.isEmpty())
    }

    @Test
    fun `exact nodeId resolves submit billing without ambiguity`() {
        val cmd = Command(action = NodeAction.CLICK, target = CommandTarget(nodeId = "a2", label = "submit"))
        val result = executor.execute(listOf(cmd), snapshot)
        assertEquals(ExecutionResult.Status.OK, result.status)
    }

    @Test
    fun `unique high-similarity label matches without nodeId`() {
        val cmd = Command(
            action = NodeAction.FILL,
            target = CommandTarget(label = "email address"),
            value = "x@y.z",
        )
        val result = executor.execute(listOf(cmd), snapshot)
        assertEquals(ExecutionResult.Status.OK, result.status)
    }

    @Test
    fun `stops at first error and keeps executed prefix`() {
        val commands = listOf(
            Command(action = NodeAction.CHECK, target = CommandTarget(nodeId = "a4")),
            Command(action = NodeAction.CLICK, target = CommandTarget(label = "no-such-thing")),
        )
        val result = executor.execute(commands, snapshot)
        assertEquals(ExecutionResult.Status.ERROR, result.status)
        assertEquals(1, result.executed.size)
    }

    @Test
    fun `fill without value fails cleanly`() {
        val cmd = Command(action = NodeAction.FILL, target = CommandTarget(nodeId = "a1"))
        val result = executor.execute(listOf(cmd), snapshot)
        assertEquals(ExecutionResult.Status.ERROR, result.status)
        assertFalse(emailField.performed.any { it.startsWith("setText") && it != "setText:" })
    }

    @Test
    fun `similarity scores near matches high`() {
        assertTrue(ActionExecutor.similarity("Submit", "submit") == 1.0)
        assertTrue(ActionExecutor.similarity("submit billing", "submit billin") > 0.85)
        assertTrue(ActionExecutor.similarity("email", "password") < 0.5)
    }

    @Test
    fun `navigate next performs click`() {
        val next = FakeA11yNode(
            className = "android.widget.Button",
            text = "Next",
            isClickable = true,
            boundsTop = 300, boundsRight = 100, boundsBottom = 340,
        )
        val tree = FakeA11yNode(children = listOf(next))
        val snap = NodeParser.parseWindowNode(tree, title = "S")
        val ex = ActionExecutor { next }
        val result = ex.execute(
            listOf(Command(action = NodeAction.NAVIGATE, target = CommandTarget(nodeId = "a1", label = "next"))),
            snap,
        )
        assertEquals(ExecutionResult.Status.OK, result.status)
        assertEquals(listOf("click"), next.performed.toList())
    }
}
