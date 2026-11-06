package io.github.jackwener.dsh.feature.conversation

/** Immutable state; revision catches edit → undo-to-the-same-text and send → retype races. */
data class PolishDraft(
    val revision: Long = 0,
    val requestRevision: Long? = null,
    val original: String? = null,
    val result: String? = null,
) {
    val busy get() = requestRevision != null
    fun edited() = copy(revision = revision + 1, original = null, result = null)
    fun begin() = copy(requestRevision = revision)
    fun accepts(ticket: Long) = requestRevision == ticket && revision == ticket
    fun finish(ticket: Long) = if (requestRevision == ticket) copy(requestRevision = null) else this
}
