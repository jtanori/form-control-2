package com.voiceform.parser

import com.voiceform.model.FormNode
import com.voiceform.model.NodeType

/**
 * Maps a clicked accessibility control to a field in a fresh window snapshot.
 * Label identity wins; geometry is a bounded fallback, never an unbounded guess.
 */
object FieldTargetResolver {
    private val VALUE_TYPES = setOf(NodeType.INPUT, NodeType.CHECKBOX, NodeType.SELECT)

    fun resolveTappedField(
        nodes: List<FormNode>,
        sourceLabel: String?,
        centerX: Int,
        centerY: Int,
        maxFallbackDistancePx: Int = 64,
    ): FormNode? {
        val label = normalizeSourceLabel(sourceLabel.orEmpty())
        val candidates = nodes.filter {
            !it.offscreen && it.rect.w > 0 && it.rect.h > 0 && it.type in VALUE_TYPES
        }
        if (candidates.isEmpty()) return null

        fun labelMatches(node: FormNode): Boolean {
            if (label.isBlank()) return false
            val labels = listOfNotNull(node.displayLabel, node.label)
                .map { normalizeSourceLabel(it) }
                .filter { it.isNotBlank() }
            return labels.any { candidate ->
                candidate == label || candidate.endsWith(label) || label.endsWith(candidate)
            }
        }

        fun distance(node: FormNode): Int {
            val rect = node.rect
            val x = rect.x + rect.w / 2
            val y = rect.y + rect.h / 2
            return kotlin.math.abs(x - centerX) + kotlin.math.abs(y - centerY)
        }

        val best = candidates.minByOrNull { node ->
            (if (labelMatches(node)) 0 else 100_000) + distance(node)
        } ?: return null
        if (!labelMatches(best) && distance(best) > maxFallbackDistancePx) return null
        return best
    }

    private fun normalizeSourceLabel(value: String): String =
        NodeParser.normalizeLabel(
            (if ('/' in value) value.substringAfterLast('/').substringAfterLast('.') else value)
                .replace(Regex("([a-z0-9])([A-Z])"), "$1 $2")
                .replace(Regex("[_-]+"), " "),
        )
}
