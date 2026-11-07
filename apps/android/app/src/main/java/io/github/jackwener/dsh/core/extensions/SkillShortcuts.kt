package io.github.jackwener.dsh.core.extensions

object SkillShortcuts {
    const val limit = 3
    private val skillName = Regex("[a-z0-9]+(?:-[a-z0-9]+)*")

    // The product's recommended list will be selected separately.
    val defaults: List<String> = emptyList()

    fun normalize(names: List<String>): List<String> = names.filter(skillName::matches).distinct().take(limit)

    fun available(catalog: List<SkillInfo>?): List<SkillInfo> =
        catalog.orEmpty().filter { it.enabled && it.userInvocable && skillName.matches(it.name) }.distinctBy { it.name }

    /** DSH's tool-skill pre-step hook recognizes /name separated by whitespace. */
    fun invoke(name: String, draft: String): String {
        require(skillName.matches(name))
        return "/$name\n\n$draft"
    }

    fun pinned(names: List<String>?, catalog: List<SkillInfo>?): List<SkillInfo> {
        val enabled = available(catalog).associateBy { it.name }
        return normalize(names ?: defaults).mapNotNull(enabled::get)
    }
}
