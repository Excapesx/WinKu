package io.github.jackwener.dsh.core.provider

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class PromptPolishTest {
    @Test fun requestsUseTheSelectedProtocolWithoutToolsOrHistory() {
        ProviderProtocol.entries.forEach { protocol ->
            val body = Json.parseToJsonElement(PromptPolish.body("selected-model", "draft", "rules", protocol)).jsonObject
            assertEquals("selected-model", body["model"]!!.jsonPrimitive.content)
            assertFalse(body["stream"]!!.jsonPrimitive.boolean)
            assertNull(body["tools"])
            when (protocol) {
                ProviderProtocol.ChatCompletions -> assertEquals(2, body["messages"]!!.jsonArray.size)
                ProviderProtocol.Messages -> {
                    assertEquals("rules", body["system"]!!.jsonPrimitive.content)
                    assertEquals(1, body["messages"]!!.jsonArray.size)
                }
                ProviderProtocol.Responses -> {
                    assertEquals("draft", body["input"]!!.jsonPrimitive.content)
                    assertEquals("rules", body["instructions"]!!.jsonPrimitive.content)
                    assertNotNull(body["max_output_tokens"])
                }
            }
        }
    }

    @Test fun extractsOnlyFinalTextForAllProtocols() {
        assertEquals("result", PromptPolish.answer("""{"choices":[{"finish_reason":"stop","message":{"content":"result","reasoning_content":"secret"}}]}""", ProviderProtocol.ChatCompletions))
        assertEquals("result", PromptPolish.answer("""{"stop_reason":"end_turn","content":[{"type":"thinking","thinking":"secret"},{"type":"text","text":"result"}]}""", ProviderProtocol.Messages))
        assertEquals("result", PromptPolish.answer("""{"status":"completed","output":[{"type":"reasoning","summary":[]},{"type":"message","content":[{"type":"output_text","text":"result"}]}]}""", ProviderProtocol.Responses))
    }

    @Test fun refusesTruncatedEmptyAndToolOnlyResults() {
        val bad = listOf(
            """{"choices":[{"finish_reason":"length","message":{"content":"partial"}}]}""" to ProviderProtocol.ChatCompletions,
            """{"stop_reason":"max_tokens","content":[{"type":"text","text":"partial"}]}""" to ProviderProtocol.Messages,
            """{"status":"incomplete","output":[]}""" to ProviderProtocol.Responses,
            """{"stop_reason":"end_turn","content":[{"type":"tool_use","name":"do_it"}]}""" to ProviderProtocol.Messages,
            """{"error":{"message":"failed"}}""" to ProviderProtocol.ChatCompletions,
        )
        bad.forEach { (payload, protocol) -> assertTrue(runCatching { PromptPolish.answer(payload, protocol) }.isFailure) }
    }

    @Test fun refusesLostOrChangedReferencesAndCode() {
        val draft = "Read @file:report.pdf using /skill at https://example.com/a?q=1 and `x = 2`\n```python\nprint(1)\n```"
        assertTrue(PromptPolish.preservesReferences(draft, "Please: $draft"))
        listOf("@file:report.pdf", "/skill", "https://example.com/a?q=1", "x = 2", "print(1)").forEach {
            assertFalse(PromptPolish.preservesReferences(draft, draft.replace(it, "changed")))
        }
    }

    @Test fun disablesOnlyDeclaredReasoningControls() {
        val reasoning = ReasoningDecl(ReasoningControl.EnableThinking).reasoning()
        val body = Json.parseToJsonElement(PromptPolish.body("m", "draft", "rules", ProviderProtocol.ChatCompletions, reasoning)).jsonObject
        assertFalse(body["enable_thinking"]!!.jsonPrimitive.boolean)
        val unknown = Json.parseToJsonElement(PromptPolish.body("m", "draft", "rules", ProviderProtocol.ChatCompletions)).jsonObject
        assertNull(unknown["thinking"])
        assertNull(unknown["enable_thinking"])
    }

    @Test fun compatibleReasoningModelsUseCompletionTokenCap() {
        val body = Json.parseToJsonElement(PromptPolish.body("openai/o3-mini", "draft", "rules", ProviderProtocol.ChatCompletions)).jsonObject
        assertNotNull(body["max_completion_tokens"])
        assertNull(body["max_tokens"])
        assertFalse(PromptPolish.preservesReferences("Read C:\\data\\report.pdf", "Read C:\\data\\other.pdf"))
    }
}
