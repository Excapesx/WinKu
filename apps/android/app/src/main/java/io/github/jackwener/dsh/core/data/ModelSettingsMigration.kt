package io.github.jackwener.dsh.core.data

import androidx.datastore.core.DataMigration
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import io.github.jackwener.dsh.core.provider.ProviderConfig
import io.github.jackwener.dsh.core.provider.ModelLimits
import io.github.jackwener.dsh.core.provider.ReasoningControl
import io.github.jackwener.dsh.core.provider.ReasoningDecl
import io.github.jackwener.dsh.core.provider.newRouteId
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/** Remove the former built-in route without losing a configured key, model or other providers. */
internal class ModelSettingsMigration(
    private val readLegacyKey: () -> String?,
    private val writeKey: (String, String) -> Unit,
    private val clearLegacyKey: () -> Unit,
) : DataMigration<Preferences> {
    private val version = intPreferencesKey("model_config_version")
    private val provider = stringPreferencesKey("provider")
    private val providers = stringPreferencesKey("providers_json")
    private val model = stringPreferencesKey("model")
    private val effort = stringPreferencesKey("effort")
    private val choices = stringPreferencesKey("reasoning_choices_json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val serializer = ListSerializer(ProviderConfig.serializer())
    private val mapSerializer = MapSerializer(String.serializer(), String.serializer())
    private var copiedLegacyKey = false

    override suspend fun shouldMigrate(currentData: Preferences) = (currentData[version] ?: 0) < 2

    override suspend fun migrate(currentData: Preferences): Preferences {
        if (!shouldMigrate(currentData)) return currentData
        // A malformed record must fail migration rather than overwrite the user's provider list.
        val previous = currentData[providers]?.let { json.decodeFromString(serializer, it) }.orEmpty()
        val legacy = previous.firstOrNull { it.id == LEGACY_ROUTE }
        val legacyKey = readLegacyKey()?.takeIf { it.isNotBlank() }
        val others = previous.filterNot { it.id == LEGACY_ROUTE }.map { p ->
            if (p.preset == "anthropic" && runCatching { java.net.URI(p.baseUrl).host }.getOrNull() == "api.anthropic.com" &&
                p.protocol == io.github.jackwener.dsh.core.provider.ProviderProtocol.ChatCompletions)
                p.copy(protocol = io.github.jackwener.dsh.core.provider.ProviderProtocol.Messages, verified = emptyList()) else p
        }
        val selected = currentData[provider].orEmpty()
        val selectedModel = currentData[model] ?: "deepseek-flash"
        val oldChoices = currentData[choices]?.let { json.decodeFromString(mapSerializer, it) }.orEmpty()
        val keepLegacy = legacyKey != null || legacy?.hasKey == true
        val replacement = if (keepLegacy) {
            val id = newRouteId("deepseek", others.map { it.id })
            val old = legacy ?: ProviderConfig(LEGACY_ROUTE, "deepseek", "DeepSeek", "https://api.deepseek.com/v1", listOf("deepseek-flash", "deepseek-v4-pro"))
            val limits = old.limits.toMutableMap()
            if (currentData[effort] == "off" && (selected.isEmpty() || selected == LEGACY_ROUTE)) {
                limits[selectedModel] = (limits[selectedModel] ?: ModelLimits()).copy(reasoning = ReasoningDecl(ReasoningControl.ThinkingType))
            }
            old.copy(id = id, preset = "deepseek", baseUrl = "https://api.deepseek.com/v1", hasKey = legacyKey != null || old.hasKey,
                contextWindow = old.contextWindow ?: 1_000_000L, limits = limits,
                // The generic transport has to be verified on its own after upgrading.
                verified = emptyList())
        } else null
        // Write before the preferences commit; failures keep the original key and preferences intact.
        if (replacement != null && legacyKey != null) { writeKey(replacement.secretName, legacyKey); copiedLegacyKey = true }
        val nextChoices = oldChoices.filterKeys { !it.startsWith("$LEGACY_ROUTE/") }.toMutableMap()
        if (replacement != null) {
            oldChoices.filterKeys { it.startsWith("$LEGACY_ROUTE/") }.forEach { (key, value) ->
                nextChoices[replacement.id + key.removePrefix(LEGACY_ROUTE)] = value
            }
            if (selected.isEmpty() || selected == LEGACY_ROUTE) {
                val level = currentData[effort] ?: "high"
                nextChoices["${replacement.id}/$selectedModel"] = if (level == "off") "disabled" else level
            }
        }
        return currentData.toMutablePreferences().apply {
            this[providers] = json.encodeToString(serializer, if (replacement == null) others else listOf(replacement) + others)
            if (selected.isEmpty() || selected == LEGACY_ROUTE) {
                this[provider] = replacement?.id.orEmpty()
                this[model] = if (replacement != null) selectedModel else ""
            }
            this[choices] = json.encodeToString(mapSerializer, nextChoices)
            remove(effort)
            this[version] = 2
        }
    }

    override suspend fun cleanUp() { if (copiedLegacyKey) clearLegacyKey() }

    private companion object { const val LEGACY_ROUTE = "deepseek-official" }
}
