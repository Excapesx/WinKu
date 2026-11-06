package io.github.jackwener.dsh.feature.conversation

import org.junit.Assert.*
import org.junit.Test

class PolishDraftTest {
    @Test fun editAndRestoreOriginalTextStillInvalidatesPendingResult() {
        val pending = PolishDraft().begin()
        val ticket = pending.revision
        assertTrue(pending.accepts(ticket))
        val editedTwice = pending.edited().edited()
        assertFalse(editedTwice.accepts(ticket))
        assertFalse(editedTwice.finish(ticket).busy)
    }

    @Test fun oldRequestCannotFinishOrOverwriteANewerOne() {
        val old = PolishDraft().begin()
        val newer = old.edited().copy(requestRevision = null).begin()
        assertFalse(newer.accepts(old.revision))
        assertEquals(newer, newer.finish(old.revision))
        assertTrue(newer.accepts(newer.revision))
    }

    @Test fun manualEditsRemoveStaleUndoAndAllowPolishingAgain() {
        val applied = PolishDraft(original = "old", result = "polished")
        val edited = applied.edited()
        assertNull(edited.original)
        assertNull(edited.result)
        assertFalse(edited.busy)
    }
}
