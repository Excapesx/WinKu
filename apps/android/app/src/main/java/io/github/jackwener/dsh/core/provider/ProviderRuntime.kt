package io.github.jackwener.dsh.core.provider

/** Resolve credentials for all enabled adapters through the same named-slot contract. */
fun providerEnvironment(providers: List<ProviderConfig>, readSecret: (String) -> String?): Map<String, String> = buildMap {
    providers.filter { it.enabled }.forEach { p ->
        readSecret(p.secretName)?.takeIf { it.isNotBlank() }?.let { put(p.keyEnv, it) }
        p.headers.filter { it.secret }.forEach { h ->
            readSecret(p.headerSecretName(h.name))?.takeIf { it.isNotBlank() }?.let { put(p.headerEnv(h.name), it) }
        }
    }
}

/** Only the hash is retained. Rotating any adapter's credential must invalidate a running process. */
fun providerFingerprint(patch: String, environment: Map<String, String>): String {
    val md = java.security.MessageDigest.getInstance("SHA-256")
    fun field(value: String) {
        val bytes = value.toByteArray(Charsets.UTF_8)
        md.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.size).array())
        md.update(bytes)
    }
    field(patch)
    environment.toSortedMap().forEach { (name, value) -> field(name); field(value) }
    return md.digest().joinToString("") { "%02x".format(it) }
}
