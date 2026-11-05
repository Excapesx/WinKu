package io.github.jackwener.dsh.core.data

import androidx.datastore.core.DataMigration
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import io.github.jackwener.dsh.core.provider.DEEPSEEK_PROVIDER
import io.github.jackwener.dsh.core.provider.ProviderConfig
import io.github.jackwener.dsh.core.provider.deepSeekProvider
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/** Upgrade once, before any settings reader/writer runs. Encrypted keys stay in their original slots. */
internal class ModelSettingsMigration(private val hasLegacyKey: () -> Boolean) : DataMigration<Preferences> {
    private val version = intPreferencesKey("model_config_version")
    private val provider = stringPreferencesKey("provider")
    private val providers = stringPreferencesKey("providers_json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val serializer = ListSerializer(ProviderConfig.serializer())

    override suspend fun shouldMigrate(currentData: Preferences) = (currentData[version] ?: 0) < 1

    override suspend fun migrate(currentData: Preferences): Preferences {
        // A malformed record must fail migration rather than overwrite the user's provider list.
        val previous = currentData[providers]?.let { json.decodeFromString(serializer, it) }.orEmpty()
        val next = if (previous.any { it.id == DEEPSEEK_PROVIDER }) previous else listOf(deepSeekProvider(hasLegacyKey())) + previous
        return currentData.toMutablePreferences().apply {
            this[providers] = json.encodeToString(serializer, next)
            this[provider] = currentData[provider]?.takeIf { it.isNotEmpty() } ?: DEEPSEEK_PROVIDER
            this[version] = 1
        }
    }

    override suspend fun cleanUp() = Unit
}
