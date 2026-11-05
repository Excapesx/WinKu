package io.github.jackwener.dsh.core.data

import androidx.datastore.preferences.core.*
import io.github.jackwener.dsh.core.provider.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class ModelSettingsMigrationTest {
    private val provider = stringPreferencesKey("provider")
    private val providers = stringPreferencesKey("providers_json")
    private val model = stringPreferencesKey("model")
    private val effort = stringPreferencesKey("effort")
    private val json = Json { encodeDefaults = true }
    private val list = ListSerializer(ProviderConfig.serializer())
    private val cloud = ProviderConfig("kimi", "kimi", "Kimi", "https://example.com/v1", listOf("m"), hasKey = true,
        limits = mapOf("m" to ModelLimits(contextWindow = 262144)), headers = listOf(ProviderHeader("X-Key", secret = true)))

    @Test fun legacyDeepSeekKeepsModelEffortAndKeySlot() = runBlocking {
        val migration = ModelSettingsMigration { true }
        val upgraded = migration.migrate(preferencesOf(provider to "", model to "deepseek-v4-pro", effort to "max"))
        assertEquals(DEEPSEEK_PROVIDER, upgraded[provider])
        assertEquals("deepseek-v4-pro", upgraded[model])
        assertEquals("max", upgraded[effort])
        val p = json.decodeFromString(list, upgraded[providers]!!).single()
        assertTrue(p.hasKey)
        assertEquals("provider-deepseek-official", p.secretName)
        assertFalse(migration.shouldMigrate(upgraded))
    }

    @Test fun cloudSelectionAndEveryProviderFieldSurvive() = runBlocking {
        val migration = ModelSettingsMigration { false }
        val old = preferencesOf(provider to "kimi", model to "m", providers to json.encodeToString(list, listOf(cloud)))
        val upgraded = migration.migrate(old)
        assertEquals("kimi", upgraded[provider]); assertEquals("m", upgraded[model])
        val all = json.decodeFromString(list, upgraded[providers]!!)
        assertEquals(cloud, all.last()); assertEquals(2, all.size)
        assertFalse(all.first().hasKey)
        assertEquals(upgraded, migration.migrate(upgraded))
    }

    @Test fun removedProviderDoesNotBecomeDeepSeek() = runBlocking {
        val upgraded = ModelSettingsMigration { true }.migrate(preferencesOf(provider to "gone", model to "old-model"))
        val choice = resolveChoice(upgraded[provider]!!, upgraded[model]!!, json.decodeFromString(list, upgraded[providers]!!))
        assertEquals(ModelConfigProblem.ProviderMissing, choice.problem)
        assertEquals("old-model", choice.model)
    }

    @Test fun malformedProviderJsonIsNeverOverwritten() = runBlocking {
        val old = preferencesOf(providers to "invalid-json")
        assertTrue(runCatching { ModelSettingsMigration { true }.migrate(old) }.isFailure)
        assertEquals("invalid-json", old[providers])
    }
}
