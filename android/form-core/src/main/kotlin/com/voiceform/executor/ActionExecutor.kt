package com.voiceform.executor

import com.voiceform.model.Command
import com.voiceform.model.CommandTarget
import com.voiceform.model.ExecutionResult
import com.voiceform.model.FormNode
import com.voiceform.model.FormSnapshot
import com.voiceform.model.NodeAction
import com.voiceform.parser.A11yNode

/**
 * AND-003 — execute Command[] against the live accessibility tree.
 * Mirrors EXT-003: fuzzy label match, >1 above 70% → ambiguity (never guess).
 */
class ActionExecutor(
    private val resolveNode: (FormNode) -> A11yNode?,
) {

    constructor() : this({ null })

    data class MatchResult(
        val status: ExecutionResult.Status,
        val node: FormNode? = null,
        val candidates: List<FormNode> = emptyList(),
        val error: String? = null,
    )

    fun matchTarget(command: Command, context: FormSnapshot): MatchResult {
        val target = command.target
        target.nodeId?.let { id ->
            context.nodes.firstOrNull { it.nodeId == id }?.let {
                return MatchResult(ExecutionResult.Status.OK, node = it)
            }
        }
        val label = (target.label ?: "").lowercase().trim()
        if (label.isBlank() && target.index == null) {
            return MatchResult(ExecutionResult.Status.ERROR, error = "command target has no locator")
        }
        target.index?.let { idx ->
            context.nodes.getOrNull(idx)?.let {
                return MatchResult(ExecutionResult.Status.OK, node = it)
            }
        }
        if (label.isBlank()) {
            return MatchResult(ExecutionResult.Status.ERROR, error = "unresolved target")
        }

        val scored = context.nodes
            .map { it to maxOf(similarity(label, it.label), similarity(label, it.displayLabel?.lowercase() ?: "")) }
            .filter { it.second >= 0.70 }
            .sortedByDescending { it.second }

        if (scored.size == 1) return MatchResult(ExecutionResult.Status.OK, node = scored[0].first)
        if (scored.size > 1) {
            val exact = scored.filter { it.second >= 0.999 }
            if (exact.size == 1) return MatchResult(ExecutionResult.Status.OK, node = exact[0].first)
            return MatchResult(
                ExecutionResult.Status.AMBIGUITY,
                candidates = scored.map { it.first },
            )
        }

        val contains = context.nodes.filter {
            it.label.contains(label) || label.contains(it.label)
        }
        return when {
            contains.size == 1 -> MatchResult(ExecutionResult.Status.OK, node = contains[0])
            contains.size > 1 -> MatchResult(ExecutionResult.Status.AMBIGUITY, candidates = contains)
            else -> MatchResult(ExecutionResult.Status.ERROR, error = "no node matches \"$label\"")
        }
    }

    fun execute(commands: List<Command>, context: FormSnapshot): ExecutionResult {
        val executed = mutableListOf<Command>()
        for (command in commands) {
            val match = matchTarget(command, context)
            if (match.status == ExecutionResult.Status.AMBIGUITY) {
                return ExecutionResult(
                    status = ExecutionResult.Status.AMBIGUITY,
                    executed = executed,
                    candidates = match.candidates,
                    error = "ambiguous target \"${command.target.label}\"",
                )
            }
            if (match.status == ExecutionResult.Status.ERROR || match.node == null) {
                return ExecutionResult(
                    status = ExecutionResult.Status.ERROR,
                    executed = executed,
                    error = match.error ?: "target not found",
                )
            }
            val live = resolveNode(match.node)
            if (live == null) {
                return ExecutionResult(
                    status = ExecutionResult.Status.ERROR,
                    executed = executed,
                    error = "element for ${match.node.nodeId} not in tree",
                )
            }
            val ok = runAction(command, live)
            if (!ok) {
                return ExecutionResult(
                    status = ExecutionResult.Status.ERROR,
                    executed = executed,
                    error = "action ${command.action.wireName()} failed on ${match.node.nodeId}",
                )
            }
            executed += command
        }
        return ExecutionResult(status = ExecutionResult.Status.OK, executed = executed)
    }

    private fun runAction(command: Command, node: A11yNode): Boolean {
        return when (command.action) {
            NodeAction.FILL -> {
                val value = command.value ?: return false
                node.performAccessibilityFocus()
                node.performSetText(value)
            }
            NodeAction.CLEAR -> node.performSetText("")
            NodeAction.CLICK -> node.performClick()
            NodeAction.CHECK -> node.performCheck()
            NodeAction.UNCHECK -> node.performUncheck()
            NodeAction.NAVIGATE -> {
                val label = (command.target.label ?: "").lowercase()
                if (listOf("next", "back", "previous", "continue").any { label.contains(it) }) {
                    node.performClick()
                } else {
                    node.performAccessibilityFocus()
                }
            }
        }
    }

    companion object {
        fun similarity(a: String, b: String): Double {
            val s1 = a.lowercase().trim()
            val s2 = b.lowercase().trim()
            if (s1 == s2) return 1.0
            if (s1.isEmpty() || s2.isEmpty()) return 0.0
            val dist = levenshtein(s1, s2)
            return 1.0 - dist.toDouble() / maxOf(s1.length, s2.length)
        }

        fun levenshtein(a: String, b: String): Int {
            val m = a.length
            val n = b.length
            var prev = IntArray(n + 1) { it }
            var cur = IntArray(n + 1)
            for (i in 1..m) {
                cur[0] = i
                for (j in 1..n) {
                    val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                    cur[j] = minOf(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
                }
                val tmp = prev
                prev = cur
                cur = tmp
            }
            return prev[n]
        }
    }
}

