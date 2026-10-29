package com.voiceform.model

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RiskTest {

    private fun cmd(
        action: NodeAction,
        label: String? = null,
        confirmRequired: Boolean = false,
    ) = Command(
        action = action,
        target = CommandTarget(label = label, nodeId = "a1"),
        confirmRequired = confirmRequired,
    )

    @Test
    fun `submit and pay clicks are risky`() {
        assertTrue(isRisky(listOf(cmd(NodeAction.CLICK, "submit billing"))))
        assertTrue(isRisky(listOf(cmd(NodeAction.CLICK, "Pay now"))))
        assertTrue(isRisky(listOf(cmd(NodeAction.CLICK, "Place order"))))
    }

    @Test
    fun `ordinary fills and navigation are not risky`() {
        assertFalse(
            isRisky(
                listOf(
                    cmd(NodeAction.FILL, "email address"),
                    cmd(NodeAction.NAVIGATE, "next"),
                ),
            ),
        )
    }

    @Test
    fun `confirmRequired flag forces risky`() {
        assertTrue(isRisky(listOf(cmd(NodeAction.FILL, "notes", confirmRequired = true))))
    }

    @Test
    fun `empty command list is not risky`() {
        assertFalse(isRisky(emptyList()))
    }
}
