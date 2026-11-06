package io.github.jackwener.dsh.feature.learning

/** Reuse the offline renderer for equations and highlighted code, including unfinished stream fences. */
private val codeOpening = Regex("^ {0,3}(?:`{3,}|~{3,})|^(?: {4,}|\\t)\\S", RegexOption.MULTILINE)
internal fun needsWebTextLayout(text: String): Boolean = text.contains('$') || text.contains("\\(") ||
    text.contains("\\[") || text.contains("**“") || text.contains("**「") || text.contains("**\"") || codeOpening.containsMatchIn(text)
