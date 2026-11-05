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
    private val version = intPreferencesKey("model_config_version")
    private val choices = stringPreferencesKey("reasoning_choices_json")
    private val json = Json { encodeDefaults = true }
    private val list = ListSerializer(ProviderConfig.serializer())
    private val cloud = ProviderConfig("kimi", "kimi", "Kimi", "https://example.com/v1", listOf("m"), hasKey = true,
        limits = mapOf("m" to ModelLimits(contextWindow = 262144)), headers = listOf(ProviderHeader("X-Key", secret = true)))
    private fun migration(key: String? = null, write: (String, String) -> Unit = { _, _ -> }, cleanup: () -> Unit = {}) =
        ModelSettingsMigration({ key }, write, cleanup)
    private fun configured(p: androidx.datastore.preferences.core.Preferences) = json.decodeFromString(list, p[providers]!!)

    @Test fun freshInstallDoesNotSelectOrConfigureAnyVendor() = runBlocking {
        val upgraded = migration().migrate(emptyPreferences())
        assertTrue(configured(upgraded).isEmpty())
        assertEquals("", upgraded[provider]); assertEquals("", upgraded[model])
        assertEquals(ModelConfigProblem.NoSelection, Settings().choice.problem)
        assertTrue(Settings().providers.isEmpty())
    }

    @Test fun legacyKeyBecomesAnOrdinaryProviderAndIsClearedOnlyAfterCommit() = runBlocking {
        val writes = mutableMapOf<String, String>(); var cleared = false
        val migration = migration("test-legacy-key", { name, value -> writes[name] = value }, { cleared = true })
        val upgraded = migration.migrate(preferencesOf(provider to "", model to "deepseek-v4-pro", effort to "max"))
        val p = configured(upgraded).single()
        assertEquals("deepseek", p.id); assertEquals(p.id, upgraded[provider])
        assertEquals("deepseek-v4-pro", upgraded[model]); assertNull(upgraded[effort])
        assertEquals("test-legacy-key", writes[p.secretName]); assertTrue(p.hasKey)
        assertTrue(upgraded[choices]!!.contains("deepseek/deepseek-v4-pro")); assertTrue(upgraded[choices]!!.contains("max"))
        assertFalse(upgraded[providers]!!.contains("test-legacy-key"))
        assertFalse(cleared); migration.cleanUp(); assertTrue(cleared)
        assertFalse(migration.shouldMigrate(upgraded)); assertEquals(upgraded, migration.migrate(upgraded))
    }

    @Test fun emptyVersionOnePlaceholderIsRemoved() = runBlocking {
        val placeholder = ProviderConfig("deepseek-official", "deepseek", "DeepSeek", "https://api.deepseek.com", listOf("deepseek-flash"))
        val upgraded = migration().migrate(preferencesOf(version to 1, provider to placeholder.id, model to "deepseek-flash", providers to json.encodeToString(list, listOf(placeholder, cloud))))
        assertEquals(listOf(cloud), configured(upgraded)); assertEquals("", upgraded[provider]); assertEquals("", upgraded[model])
    }

    @Test fun cloudSelectionAndEveryProviderFieldSurvive() = runBlocking {
        val old = preferencesOf(provider to "kimi", model to "m", providers to json.encodeToString(list, listOf(cloud)))
        val upgraded = migration().migrate(old)
        assertEquals("kimi", upgraded[provider]); assertEquals("m", upgraded[model]); assertEquals(listOf(cloud), configured(upgraded))
    }

    @Test fun collisionsAndLegacyReasoningOffAreMigrated() = runBlocking {
        val existing = cloud.copy(id = "deepseek")
        val old = preferencesOf(provider to "deepseek-official", model to "deepseek-flash", effort to "off", providers to json.encodeToString(list, listOf(existing)))
        val upgraded = migration("test-key").migrate(old)
        val p = configured(upgraded).first()
        assertEquals("deepseek-2", p.id); assertEquals(existing, configured(upgraded).last())
        assertEquals(ReasoningControl.ThinkingType, p.limits["deepseek-flash"]!!.reasoning!!.control)
        assertTrue(upgraded[choices]!!.contains("disabled"))
    }

    @Test fun removedProviderIsNotSubstituted() = runBlocking {
        val upgraded = migration("test-key").migrate(preferencesOf(provider to "gone", model to "old-model"))
        val choice = resolveChoice(upgraded[provider]!!, upgraded[model]!!, configured(upgraded))
        assertEquals(ModelConfigProblem.ProviderMissing, choice.problem); assertEquals("old-model", choice.model)
    }

    @Test fun malformedSettingsOrFailedKeyCopyNeverClearLegacyData() = runBlocking {
        var cleared = false
        val migration = migration("test-key", { _, _ -> error("disk failure") }, { cleared = true })
        val malformed = preferencesOf(providers to "invalid-json")
        assertTrue(runCatching { migration.migrate(malformed) }.isFailure)
        assertEquals("invalid-json", malformed[providers])
        assertTrue(runCatching { migration.migrate(emptyPreferences()) }.isFailure)
        assertFalse(cleared)
    }
}
