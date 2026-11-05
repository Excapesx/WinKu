package io.github.jackwener.dsh.core.provider

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class ProviderProtocolTest {
    @Test fun presetsAndPatchAgreeOnProtocol() {
        assertEquals(ProviderProtocol.Messages, presetOf("anthropic")!!.protocol)
        ProviderProtocol.entries.forEach { protocol ->
            val p = ProviderConfig("p", CUSTOM, "P", "https://example.com/v1", listOf("m"), protocol = protocol)
            assertTrue(renderProfilePatch(listOf(p), false).contains("\"interfaceType\":\"${protocol.wire}\""))
        }
    }

    @Test fun requestSchemasAreProtocolSpecific() {
        val messages = Json.parseToJsonElement(probeBody("m", true, ProviderProtocol.Messages)).jsonObject
        assertNotNull(messages["messages"]); assertNotNull(messages["max_tokens"]); assertNull(messages["input"])
        assertEquals("tool", messages["tool_choice"]!!.jsonObject["type"]!!.jsonPrimitive.content)
        assertNotNull(messages["tools"]!!.jsonArray[0].jsonObject["input_schema"])
        val responses = Json.parseToJsonElement(probeBody("m", true, ProviderProtocol.Responses)).jsonObject
        assertNotNull(responses["input"]); assertNotNull(responses["max_output_tokens"]); assertNull(responses["messages"])
        assertEquals(PROBE_TOOL, responses["tools"]!!.jsonArray[0].jsonObject["name"]!!.jsonPrimitive.content)
    }

    @Test fun nativeResponsesAreRecognizedWithoutMistakingTextForAToolCall() {
        assertNull(readProbeAnswer(sequenceOf("""{"content":[{"type":"tool_use","name":"$PROBE_TOOL","input":{}}]}""")))
        assertNull(readProbeAnswer(sequenceOf("""{"output":[{"type":"function_call","name":"$PROBE_TOOL","arguments":"{}"}]}""")))
        assertTrue(readProbeAnswer(sequenceOf("""{"content":[{"type":"text","text":"I will call function_call"}]}""")) is VerifyFailure.NoToolCall)
        assertEquals(mapOf("anthropic-version" to "2023-06-01", "x-api-key" to "key"), ProviderProtocol.Messages.authHeaders("key"))
        assertEquals(mapOf("Authorization" to "Bearer key"), ProviderProtocol.Responses.authHeaders("key"))
    }
}
