package io.github.jackwener.dsh.feature.learning

import android.content.Context
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/** Bounded, app-private snapshots. The key includes the conversation and message identity. */
class ArtifactStateStore(context: Context) {
    private val prefs = context.getSharedPreferences("learning_artifacts_v1", Context.MODE_PRIVATE)
    fun load(key: String): JsonObject = runCatching {
        Json.parseToJsonElement(prefs.getString(key, "{}")!!) as JsonObject
    }.getOrElse { JsonObject(emptyMap()) }

    @Synchronized fun save(key: String, value: JsonObject) {
        val encoded = value.toString()
        if (encoded.length > 48_000) return
        val editor = prefs.edit().putString(key, encoded).putLong("at:$key", System.currentTimeMillis())
        val keys = prefs.all.filterKeys { !it.startsWith("at:") && it != key }.keys
        keys.sortedBy { prefs.getLong("at:$it", 0) }.take((keys.size - 63).coerceAtLeast(0)).forEach {
            editor.remove(it).remove("at:$it")
        }
        editor.apply()
    }
}
