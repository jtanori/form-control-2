package com.voiceform.parser

import com.voiceform.model.NodeAction
import com.voiceform.model.NodeType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NodeParserTest {

    private fun checkoutTree() = FakeA11yNode(
        className = "android.widget.FrameLayout",
        children = listOf(
            FakeA11yNode(
                className = "android.widget.EditText",
                viewIdResourceName = "com.shop:id/et_email_address",
                contentDescription = "Email address",
                text = "user@example.com",
                isEditable = true,
                boundsLeft = 100, boundsTop = 200, boundsRight = 400, boundsBottom = 240,
            ),
            FakeA11yNode(
                className = "android.widget.Spinner",
                viewIdResourceName = "com.shop:id/spinner_country",
                contentDescription = "Country",
                isClickable = true,
                boundsLeft = 100, boundsTop = 260, boundsRight = 400, boundsBottom = 300,
            ),
            FakeA11yNode(
                className = "android.widget.CheckBox",
                viewIdResourceName = "com.shop:id/cb_terms",
                text = "I agree to the terms and conditions",
                isCheckable = true,
                isChecked = false,
                boundsLeft = 100, boundsTop = 320, boundsRight = 118, boundsBottom = 338,
            ),
            FakeA11yNode(
                className = "android.widget.Button",
                viewIdResourceName = "com.shop:id/btn_submit_billing",
                text = "Submit billing",
                isClickable = true,
                boundsLeft = 100, boundsTop = 360, boundsRight = 240, boundsBottom = 400,
            ),
            FakeA11yNode(
                className = "android.widget.Button",
                viewIdResourceName = "com.shop:id/btn_submit_shipping",
                text = "Submit shipping",
                isClickable = true,
                boundsLeft = 260, boundsTop = 360, boundsRight = 400, boundsBottom = 400,
            ),
            FakeA11yNode(
                className = "android.widget.ImageView",
                boundsLeft = 0, boundsTop = 0, boundsRight = 50, boundsBottom = 50,
            ),
        ),
    )

    @Test
    fun `emits contract-shaped nodes with a-prefix ids`() {
        val snap = NodeParser.parseWindowNode(checkoutTree(), title = "Checkout")
        assertEquals("accessibility", snap.source)
        assertEquals(5, snap.nodes.size) // decorative ImageView filtered
        assertEquals("a1", snap.nodes[0].nodeId)
        snap.nodes.forEach { assertTrue(it.nodeId.startsWith("a")) }
        assertEquals("accessibility", snap.nodes[0].source)
    }

    @Test
    fun `editable label prefers content description over text value`() {
        val snap = NodeParser.parseWindowNode(checkoutTree(), title = "Checkout")
        val email = snap.nodes[0]
        assertEquals("email address", email.label)
        assertEquals("Email address", email.displayLabel)
        assertEquals("user@example.com", email.value)
        assertEquals(NodeType.INPUT, email.type)
        assertEquals(listOf(NodeAction.FILL, NodeAction.CLEAR), email.actions)
    }

    @Test
    fun `checkbox carries checked state and type actions`() {
        val snap = NodeParser.parseWindowNode(checkoutTree(), title = "Checkout")
        val box = snap.nodes.first { it.type == NodeType.CHECKBOX }
        assertEquals(false, box.checked)
        assertEquals(listOf(NodeAction.CHECK, NodeAction.UNCHECK), box.actions)
        assertEquals("checkbox", box.role)
    }

    @Test
    fun `spinner is select with click and fill actions`() {
        val snap = NodeParser.parseWindowNode(checkoutTree(), title = "Checkout")
        val spinner = snap.nodes.first { it.type == NodeType.SELECT }
        assertEquals("country", spinner.label)
        assertEquals(listOf(NodeAction.CLICK, NodeAction.FILL), spinner.actions)
    }

    @Test
    fun `zero-size nodes are flagged offscreen`() {
        val tree = FakeA11yNode(
            className = "android.widget.Button",
            text = "Invisible",
            isClickable = true,
            isVisibleToUser = true,
            boundsLeft = 0, boundsTop = 0, boundsRight = 0, boundsBottom = 0,
        )
        val snap = NodeParser.parseWindowNode(tree, title = "T")
        assertEquals(1, snap.nodes.size)
        assertTrue(snap.nodes[0].offscreen)
        assertEquals(0, snap.nodes[0].rect.w)
    }

    @Test
    fun `null root yields empty snapshot`() {
        val snap = NodeParser.parseWindowNode(null, title = "Empty")
        assertTrue(snap.nodes.isEmpty())
    }

    @Test
    fun `json output matches contract keys`() {
        val snap = NodeParser.parseWindowNode(checkoutTree(), title = "Checkout")
        val json = snap.toJson()
        for (key in listOf("\"source\"", "\"capturedAt\"", "\"title\"", "\"nodes\"", "\"nodeId\"", "\"label\"", "\"type\"", "\"rect\"", "\"actions\"")) {
            assertTrue("missing $key in $json", json.contains(key))
        }
        assertFalse(json.contains("\"d1\""))
        assertNull(snap.nodes.firstOrNull { it.nodeId.startsWith("d") })
    }

    @Test
    fun `humanize view id camelCase and underscores`() {
        assertEquals(
            "et email address",
            NodeParser.humanizeViewId("com.shop:id/et_email_address"),
        )
        assertEquals(
            "btn submit billing",
            NodeParser.humanizeViewId("com.shop:id/btnSubmitBilling"),
        )
    }

    @Test
    fun `ambiguous submit buttons produce distinct labels`() {
        val snap = NodeParser.parseWindowNode(checkoutTree(), title = "Checkout")
        val submits = snap.nodes.filter { it.label.contains("submit") }
        assertEquals(2, submits.size)
        assertEquals("submit billing", submits[0].label)
        assertEquals("submit shipping", submits[1].label)
    }
}
