package io.github.jackwener.dsh.feature.conversation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.BtnSize
import io.github.jackwener.dsh.core.designsystem.BtnVariant
import io.github.jackwener.dsh.core.designsystem.DButton
import io.github.jackwener.dsh.core.designsystem.DCheckbox
import io.github.jackwener.dsh.core.designsystem.DIcon
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.Hairline
import io.github.jackwener.dsh.core.designsystem.IconBtn
import io.github.jackwener.dsh.core.designsystem.SettingsRow
import io.github.jackwener.dsh.core.designsystem.Spinner
import io.github.jackwener.dsh.core.designsystem.pressable
import io.github.jackwener.dsh.core.extensions.SkillInfo
import io.github.jackwener.dsh.core.extensions.SkillShortcuts
import io.github.jackwener.dsh.core.extensions.UserError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun SkillShortcutsBar(
    catalog: List<SkillInfo>?,
    error: UserError?,
    savedPins: List<String>?,
    selectedSkill: String?,
    onSelect: (String) -> Unit,
    onLoad: () -> Unit,
    onSave: suspend (List<String>?) -> Unit,
    onManage: () -> Unit,
) {
    val pins = SkillShortcuts.pinned(savedPins, catalog)
    var open by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.weight(1f).horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            pins.forEach { skill ->
                SkillPill(skill.name, selectedSkill == skill.name, { onSelect(skill.name) }, sparkle = true)
            }
        }
        val more = stringResource(R.string.skill_shortcuts_more)
        SkillPill(if (pins.isEmpty()) stringResource(R.string.skill_shortcuts_title) else "···", false, {
            open = true
            onLoad()
        }, sparkle = pins.isEmpty(), description = more)
    }
    if (open) SkillShortcutSheet(catalog, error, savedPins, selectedSkill, onSelect = {
        onSelect(it)
        open = false
    }, onLoad, onSave, onManage = {
        open = false
        onManage()
    }, onDismiss = { open = false })
}

@Composable
private fun SkillPill(label: String, active: Boolean, onClick: () -> Unit, sparkle: Boolean, description: String? = null) {
    val c = Dsh.colors
    val color = if (active) c.business else c.labelSecondary
    Row(Modifier.heightIn(min = 40.dp).clip(CircleShape).background(if (active) c.selector else c.bgLayer2)
        .border(Hairline, if (active) c.business else c.borderL2, CircleShape).pressable(onClick, CircleShape)
        .semantics { selected = active; if (description != null) contentDescription = description }
        .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        if (sparkle) DIcon(R.drawable.dsw_sparkle, size = 14.dp, tint = color)
        Text(label, Modifier.widthIn(max = 126.dp), style = DshType.xs13, color = color, maxLines = 1,
            overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun SelectedSkillChip(name: String, onRemove: () -> Unit) {
    val c = Dsh.colors
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        DIcon(R.drawable.dsw_sparkle, size = 14.dp, tint = c.business)
        Text(stringResource(R.string.skill_shortcuts_selected, name), Modifier.weight(1f, fill = false),
            style = DshType.xs13, color = c.business, maxLines = 1, overflow = TextOverflow.Ellipsis)
        IconBtn(R.drawable.dsw_close_outline, onRemove, size = 32.dp, iconSize = 12.dp,
            contentDescription = stringResource(R.string.skill_shortcuts_clear))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SkillShortcutSheet(
    catalog: List<SkillInfo>?, error: UserError?, savedPins: List<String>?, selectedSkill: String?,
    onSelect: (String) -> Unit, onLoad: () -> Unit, onSave: suspend (List<String>?) -> Unit,
    onManage: () -> Unit, onDismiss: () -> Unit,
) {
    val c = Dsh.colors
    val scope = rememberCoroutineScope()
    val available = SkillShortcuts.available(catalog).sortedBy { it.name }
    val enabledByName = available.associateBy { it.name }
    var editing by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf(emptyList<String>()) }
    var followDefaults by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var saveFailed by remember { mutableStateOf(false) }

    fun move(name: String, offset: Int) {
        val index = draft.indexOf(name)
        val destination = index + offset
        if (saving || index < 0 || destination !in draft.indices) return
        draft = draft.toMutableList().apply { add(destination, removeAt(index)) }
        followDefaults = false
    }

    ModalBottomSheet(onDismissRequest = { if (!saving) onDismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = c.bgLayer2, scrimColor = c.scrim, tonalElevation = 0.dp) {
        Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).padding(bottom = 12.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(if (editing) R.string.skill_shortcuts_edit_title else R.string.skill_shortcuts_title),
                    Modifier.weight(1f), style = DshType.base16m, color = c.labelPrimary)
                DButton(stringResource(if (editing) R.string.cancel else R.string.skill_shortcuts_edit), {
                    if (!editing) {
                        draft = SkillShortcuts.normalize(savedPins ?: SkillShortcuts.defaults)
                        followDefaults = savedPins == null
                        saveFailed = false
                    }
                    editing = !editing
                }, variant = BtnVariant.Ghost, size = BtnSize.Sm, enabled = !saving && catalog != null && error == null)
            }
            if (error != null) {
                SettingsRow(stringResource(R.string.skill_shortcuts_load_failed), divider = false)
                DButton(stringResource(R.string.retry), onLoad, Modifier.padding(horizontal = 16.dp),
                    variant = BtnVariant.Outline, size = BtnSize.Sm)
            } else if (catalog == null) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Spinner(14.dp)
                    Text(stringResource(R.string.skill_shortcuts_loading), style = DshType.xs13, color = c.labelSecondary)
                }
            } else if (editing) {
                Text(stringResource(R.string.skill_shortcuts_limit, SkillShortcuts.limit, draft.size),
                    Modifier.padding(horizontal = 16.dp, vertical = 8.dp), style = DshType.xs13, color = c.labelSecondary)
                val all = draft + available.map { it.name }.filterNot { it in draft }
                LazyColumn(Modifier.weight(1f, fill = false)) {
                    items(all, key = { it }) { name ->
                        val index = draft.indexOf(name)
                        val enabled = name in enabledByName
                        val toggle = !saving && (index >= 0 || (enabled && draft.size < SkillShortcuts.limit))
                        val detail = when {
                            enabled -> enabledByName.getValue(name).description.take(140).ifBlank { null }
                            catalog.any { it.name == name && it.enabled } -> stringResource(R.string.skill_shortcuts_not_invocable)
                            catalog.any { it.name == name } -> stringResource(R.string.skill_shortcuts_disabled)
                            else -> stringResource(R.string.skill_shortcuts_missing)
                        }
                        SettingsRow(name, detail, onClick = if (toggle) ({
                            if (!saving) {
                                if (name in draft) draft = draft - name
                                else if (enabled && draft.size < SkillShortcuts.limit) draft = draft + name
                                followDefaults = false
                            }
                        }) else null, leading = { DCheckbox(index >= 0, onChange = null) }, trailing = {
                            if (index >= 0) Row {
                                IconBtn(R.drawable.dsw_chevron_up_outline, { move(name, -1) }, enabled = !saving && index > 0,
                                    contentDescription = stringResource(R.string.skill_shortcuts_move_up, name))
                                IconBtn(R.drawable.dsw_chevron_down_outline, { move(name, 1) }, enabled = !saving && index < draft.lastIndex,
                                    contentDescription = stringResource(R.string.skill_shortcuts_move_down, name))
                            }
                        })
                    }
                }
                if (saveFailed) Text(stringResource(R.string.skill_shortcuts_save_failed),
                    Modifier.padding(horizontal = 16.dp, vertical = 6.dp), style = DshType.xs13, color = c.error)
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    DButton(stringResource(R.string.skill_shortcuts_restore), {
                        draft = SkillShortcuts.defaults
                        followDefaults = true
                    }, variant = BtnVariant.Ghost, enabled = !saving)
                    DButton(stringResource(R.string.save), save@{
                        if (saving) return@save
                        saving = true
                        saveFailed = false
                        scope.launch {
                            try {
                                onSave(if (followDefaults) null else draft)
                                editing = false
                            } catch (e: CancellationException) {
                                throw e
                            } catch (_: Exception) {
                                saveFailed = true
                            } finally {
                                saving = false
                            }
                        }
                    }, enabled = !saving)
                }
            } else if (available.isEmpty()) {
                SettingsRow(stringResource(R.string.skill_shortcuts_empty), stringResource(R.string.skill_shortcuts_empty_hint), divider = false)
            } else {
                LazyColumn(Modifier.weight(1f, fill = false)) {
                    items(available, key = { it.name }) { skill ->
                        SettingsRow(skill.name, skill.description.take(140).ifBlank { null }, onClick = { onSelect(skill.name) },
                            trailing = { if (skill.name == selectedSkill) DIcon(R.drawable.dsw_check_outline, size = 16.dp, tint = c.business) })
                    }
                }
            }
            if (!editing) {
                Spacer(Modifier.height(6.dp))
                DButton(stringResource(R.string.skill_shortcuts_manage), onManage, Modifier.padding(horizontal = 16.dp),
                    variant = BtnVariant.Ghost, size = BtnSize.Sm)
            }
        }
    }
}
