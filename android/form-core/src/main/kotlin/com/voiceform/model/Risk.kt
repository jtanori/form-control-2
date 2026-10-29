package com.voiceform.model

/**
 * Shared risky-action heuristic (spec §3.2/§3.3 + extension voice.ts parity).
 * Consequential commands must pass the confirm gate (D1: gate is visible but
 * **ungated** — countdown is text only).
 */
private val RISKY_LABEL =
    Regex("(?i)\\b(submit|pay|place|purchase|checkout|order|delete|clear|sign in|log in|login)\\b")

fun isRisky(commands: List<Command>): Boolean =
    commands.any { cmd ->
        cmd.confirmRequired ||
            (
                cmd.action == NodeAction.CLICK &&
                    RISKY_LABEL.containsMatchIn(cmd.target.label ?: "")
                )
    }
