package io.github.jackwener.dsh.feature.learning

/** Existing plain chat keeps its streaming native renderer; mathematical prose uses offline KaTeX. */
internal fun needsMathLayout(text: String): Boolean = text.contains('$') || text.contains("\\(") ||
    text.contains("\\[") || text.contains("**“") || text.contains("**「") || text.contains("**\"")
