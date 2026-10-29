package com.voiceform.parser

import com.voiceform.model.FormNode
import com.voiceform.model.NodeAction
import com.voiceform.model.NodeType
import com.voiceform.model.Rect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FieldTargetResolverTest {
    private fun field(
        id: String,
        label: String,
        type: NodeType = NodeType.INPUT,
        x: Int = 100,
        y: Int = 100,
        offscreen: Boolean = false,
    ) = FormNode(
        nodeId = id,
        label = label.lowercase(),
        displayLabel = label,
        type = type,
        rect = Rect(x, y, 120, 40),
        offscreen = offscreen,
        actions = when (type) {
            NodeType.CHECKBOX -> listOf(NodeAction.CHECK, NodeAction.UNCHECK)
            NodeType.SELECT -> listOf(NodeAction.CLICK, NodeAction.FILL)
            else -> listOf(NodeAction.FILL, NodeAction.CLEAR)
        },
    )

    @Test
    fun `accessible label takes precedence over a closer unrelated field`() {
        val near = field("a1", "First name", x = 100, y = 100)
        val labelled = field("a2", "Email address", x = 500, y = 500)

        val result = FieldTargetResolver.resolveTappedField(
            nodes = listOf(near, labelled),
            sourceLabel = "com.shop:id/email_address",
            centerX = 150,
            centerY = 120,
        )

        assertEquals("a2", result?.nodeId)
    }

    @Test
    fun `geometry fallback selects the nearest value control within bound`() {
        val first = field("a1", "First name", x = 100, y = 100)
        val second = field("a2", "Email", x = 300, y = 100)

        val result = FieldTargetResolver.resolveTappedField(
            nodes = listOf(first, second),
            sourceLabel = null,
            centerX = 315,
            centerY = 120,
        )

        assertEquals("a2", result?.nodeId)
    }

    @Test
    fun `unlabelled controls do not become false label matches`() {
        val blank = field("a1", "", x = 100, y = 100)
        val named = field("a2", "Email", x = 300, y = 100)

        val result = FieldTargetResolver.resolveTappedField(
            nodes = listOf(blank, named),
            sourceLabel = "Email",
            centerX = 105,
            centerY = 105,
        )

        assertEquals("a2", result?.nodeId)
    }

    @Test
    fun `rejects distant unlabeled events and excludes non-value or offscreen controls`() {
        val button = field("a1", "Submit", type = NodeType.BUTTON, x = 100, y = 100)
        val hidden = field("a2", "Email", x = 100, y = 100, offscreen = true)
        val far = field("a3", "Name", x = 1000, y = 1000)

        assertNull(
            FieldTargetResolver.resolveTappedField(
                nodes = listOf(button, hidden, far),
                sourceLabel = null,
                centerX = 0,
                centerY = 0,
            ),
        )
    }
}
