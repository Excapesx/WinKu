import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src-tauri/installer');
let template = fs.readFileSync(path.join(root, 'upstream-template.nsi'), 'utf8');
const hash = crypto.createHash('sha256').update(template).digest('hex');
if (hash !== 'd00089d3b1a2c4a30d7b6e098079100cb8f25e980f84d4515aca4597b95e967d') throw Error('Upstream installer template changed; review before customizing it.');
function replace(before, after) {
  if (!template.includes(before)) throw Error(`Installer integration anchor missing: ${before.slice(0, 80)}`);
  template = template.replace(before, after);
}
replace('!define STARTMENUFOLDER "{{start_menu_folder}}"', '!define STARTMENUFOLDER "{{start_menu_folder}}"\n\n!insertmacro WINKU_UI_FUNCTIONS');
replace('!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive\n!insertmacro MUI_PAGE_WELCOME', 'Page custom WinKuWelcome WinKuWelcomeLeave');
replace('!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive\n!insertmacro MUI_PAGE_DIRECTORY', '; Installation location is edited and validated by WinKuWelcome.');
replace('!insertmacro MUI_PAGE_INSTFILES', '!define MUI_PAGE_CUSTOMFUNCTION_SHOW WinKuInstFilesShow\n!insertmacro MUI_PAGE_INSTFILES');
replace('  File "${MAINBINARYSRCPATH}"', '  File "${MAINBINARYSRCPATH}"\n  !insertmacro WINKU_CANCELLATION_CHECKPOINT');
replace('    File /a "/oname={{this.[1]}}" "{{no-escape @key}}"', '    File /a "/oname={{this.[1]}}" "{{no-escape @key}}"\n    !insertmacro WINKU_CANCELLATION_CHECKPOINT');
const finishStart = template.indexOf('; 8. Finish page');
const finishEnd = template.indexOf('Function RunMainBinary', finishStart);
if (finishStart < 0 || finishEnd < 0) throw Error('Finish page integration anchors missing');
template = template.slice(0, finishStart) + '; 8. WinKu completion page\nPage custom WinKuFinish WinKuFinishLeave\n\n' + template.slice(finishEnd);
replace('    ${NSD_SetFocus} $R2\n    nsDialogs::Show', '    ${NSD_SetFocus} $R2\n    WinKuInstaller::Page /NOUNLOAD "$R4" "maintenance"\n    nsDialogs::Show');
// Interactive users choose shortcuts on the welcome page; keep upstream silent
// and passive behavior intact. Never remove existing application data on upgrade.
replace('  ; Auto close this page for passive mode', '  ${If} $PassiveMode != 1\n  ${AndIfNot} ${Silent}\n  ${AndIf} $WinKuDesktopState == ${BST_CHECKED}\n    Call CreateOrUpdateDesktopShortcut\n  ${EndIf}\n  SetAutoClose true\n\n  ; Auto close this page for passive mode');
fs.writeFileSync(path.join(root, 'WinKu.nsi'), '; Customized from Tauri CLI v2.12.4. See README.md for provenance.\n' + template);
console.log('Prepared branded installer template; upstream installation and uninstall sections retained.');
