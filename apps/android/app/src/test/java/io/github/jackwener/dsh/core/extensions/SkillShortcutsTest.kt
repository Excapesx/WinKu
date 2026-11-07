package io.github.jackwener.dsh.core.extensions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SkillShortcutsTest {
    @Test fun pinnedOrderSurvivesAnUnavailableSkillWithoutReplacingIt() {
        val saved = listOf("summary", "flashcards", "outline")
        val catalog = listOf(SkillInfo("outline"), SkillInfo("flashcards", enabled = false), SkillInfo("summary"), SkillInfo("other"))
        assertEquals(listOf("summary", "outline"), SkillShortcuts.pinned(saved, catalog).map { it.name })
        val enabled = catalog.map { it.copy(enabled = true) }
        assertEquals(saved, SkillShortcuts.pinned(saved, enabled).map { it.name })
    }

    @Test fun picksOnlyManuallyInvocableSkillsAndKeepsTheFullDraft() {
        val catalog = listOf(SkillInfo("summary", userInvocable = false), SkillInfo("flashcards"), SkillInfo("bad name"))
        assertEquals(listOf("flashcards"), SkillShortcuts.available(catalog).map { it.name })
        val draft = "保留这段草稿。\n[附件: /home/notes.pdf]"
        assertEquals("/flashcards\n\n$draft", SkillShortcuts.invoke("flashcards", draft))
        assertThrows(IllegalArgumentException::class.java) { SkillShortcuts.invoke("flashcards\n/another", draft) }
    }
}
