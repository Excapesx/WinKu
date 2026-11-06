package io.github.jackwener.dsh.feature.learning

import org.junit.Assert.*
import org.junit.Test

class RichContentTest {
    @Test fun ordinaryAndUnfinishedCodeFencesUseTheHighlightedRenderer() {
        for (input in listOf("```cpp\nint* p = new int(10);", "~~~python\nprint(1)\n~~~", "    return value")) assertTrue(needsWebTextLayout(input))
        assertFalse(needsWebTextLayout("普通的中文讲解。"))
        val input = "```dsh-visual\n{\"type\":\"explanation\",\"layout\":\"steps\",\"items\":[{\"title\":\"声明\"}]}\n```"
        assertTrue(RichContent.parse(input).single() is RichPart.Artifact)
    }
    @Test fun completeComponentsPreserveSurroundingMarkdown() {
        val parts = RichContent.parse("Before\n```dsh-visual\n{\"type\":\"function\",\"functions\":[{\"expression\":\"x^2\"}]}\n```\nAfter")
        assertEquals(3, parts.size)
        assertEquals("Before\n", (parts[0] as RichPart.Markdown).text)
        assertEquals("function", (parts[1] as RichPart.Artifact).payload["type"].toString().trim('"'))
        assertEquals("After", (parts[2] as RichPart.Markdown).text)
    }
    @Test fun streamedOrInvalidJsonStaysReadable() {
        for (input in listOf("```dsh-visual\n{\"type\":", "```dsh-visual\ninvalid\n```", "```dsh-visual\n{\"type\":\"unknown\"}\n```")) {
            assertEquals(listOf(RichPart.Markdown(input)), RichContent.parse(input))
        }
    }
    @Test fun documentedFencesInsideCodeAreNotExecuted() {
        val input = "````markdown\n```dsh-visual\n{\"type\":\"math\",\"latex\":\"x\"}\n```\n````"
        assertEquals(listOf(RichPart.Markdown(input)), RichContent.parse(input))
    }
    @Test fun mermaidAndExplicitHtmlHaveDifferentTypes() {
        val diagram = RichContent.parse("```mermaid\nflowchart LR\n A-->B\n```").single() as RichPart.Artifact
        assertEquals("\"diagram\"", diagram.payload["type"].toString())
        assertTrue(RichContent.parse("```html\n<script>alert(1)</script>\n```").single() is RichPart.Markdown)
        assertTrue(RichContent.parse("```dsh-html\n<button>Try</button>\n```").single() is RichPart.Artifact)
    }
}
