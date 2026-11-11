; WinKu presentation only. The upstream Tauri script owns installation, upgrade,
; WebView2, shortcuts, registry, silent mode and uninstall.
!include nsDialogs.nsh
!include LogicLib.nsh
!define WINKU_UI_DIR "${__FILEDIR__}"
!addplugindir /x86-unicode "${WINKU_UI_DIR}\plugins"
!define MUI_CUSTOMFUNCTION_GUIINIT WinKuGUIInit
!define MUI_BGCOLOR "17171A"
!define MUI_TEXTCOLOR "F5F5F7"
!define MUI_INSTFILESPAGE_COLORS "B4B4BE 121214"
!define MUI_INSTFILESPAGE_PROGRESSBAR smooth
!define MUI_ABORTWARNING
Var WinKuDialog
Var WinKuPathInput
Var WinKuPathButton
Var WinKuBrowseButton
Var WinKuPathExpanded
Var WinKuDesktopCheckbox
Var WinKuDesktopState
Var WinKuLaunchCheckbox
Var WinKuLaunchState
Var WinKuLicense

!macro WinKuPlace HANDLE X Y W H FONT
  WinKuInstaller::Place /NOUNLOAD "${HANDLE}" "${X}" "${Y}" "${W}" "${H}" "${FONT}"
!macroend

!macro WINKU_CANCELLATION_CHECKPOINT
  ${IfNot} ${Silent}
    WinKuInstaller::Cancelled /NOUNLOAD
    Pop $0
    ${If} $0 == 1
      Abort "用户取消安装。可重新运行安装器继续安装。"
    ${EndIf}
  ${EndIf}
!macroend

!macro WINKU_UI_FUNCTIONS
Function WinKuGUIInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\winku-left.png "${WINKU_UI_DIR}\left-panel.png"
  File /oname=$PLUGINSDIR\WinKu-Open-Source.txt "${WINKU_UI_DIR}\NOTICES.txt"
  StrCpy $WinKuDesktopState ${BST_CHECKED}
  StrCpy $WinKuLaunchState ${BST_CHECKED}
  StrCpy $WinKuPathExpanded 0
  WinKuInstaller::Initialize /NOUNLOAD "$PLUGINSDIR\winku-left.png"
FunctionEnd

Function WinKuLicenseClick
  Pop $0
  ExecShell "open" "$PLUGINSDIR\WinKu-Open-Source.txt"
FunctionEnd

Function WinKuCommon
  ${NSD_CreateLink} 0 0 0 0 "开源许可"
  Pop $WinKuLicense
  !insertmacro WinKuPlace $WinKuLicense 806 520 70 25 11
  ${NSD_OnClick} $WinKuLicense WinKuLicenseClick
FunctionEnd

Function WinKuWelcome
  Call SkipIfPassive
  nsDialogs::Create 1018
  Pop $WinKuDialog
  ${If} $WinKuDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateButton} 0 0 0 0 "安装位置                         默认位置  >"
  Pop $WinKuPathButton
  !insertmacro WinKuPlace $WinKuPathButton 364 258 512 34 13
  ${NSD_OnClick} $WinKuPathButton WinKuTogglePath
  ${NSD_CreateText} 0 0 0 0 "$INSTDIR"
  Pop $WinKuPathInput
  !insertmacro WinKuPlace $WinKuPathInput 364 300 414 34 12
  ShowWindow $WinKuPathInput ${SW_HIDE}
  ${NSD_CreateButton} 0 0 0 0 "浏览"
  Pop $WinKuBrowseButton
  !insertmacro WinKuPlace $WinKuBrowseButton 790 300 86 34 12
  ${NSD_OnClick} $WinKuBrowseButton WinKuBrowse
  ShowWindow $WinKuBrowseButton ${SW_HIDE}
  ${NSD_CreateCheckbox} 0 0 0 0 "创建桌面快捷方式"
  Pop $WinKuDesktopCheckbox
  !insertmacro WinKuPlace $WinKuDesktopCheckbox 364 301 512 30 13
  ${NSD_SetState} $WinKuDesktopCheckbox $WinKuDesktopState
  StrCpy $WinKuPathExpanded 0
  Call WinKuCommon
  WinKuInstaller::Page /NOUNLOAD "$WinKuDialog" "welcome"
  nsDialogs::Show
FunctionEnd

Function WinKuTogglePath
  Pop $0
  ${If} $WinKuPathExpanded == 0
    StrCpy $WinKuPathExpanded 1
    ShowWindow $WinKuPathInput ${SW_SHOW}
    ShowWindow $WinKuBrowseButton ${SW_SHOW}
    !insertmacro WinKuPlace $WinKuDesktopCheckbox 364 348 512 30 13
    ${NSD_SetText} $WinKuPathButton "安装位置                         收起  <"
    ${NSD_SetFocus} $WinKuPathInput
  ${Else}
    StrCpy $WinKuPathExpanded 0
    ShowWindow $WinKuPathInput ${SW_HIDE}
    ShowWindow $WinKuBrowseButton ${SW_HIDE}
    !insertmacro WinKuPlace $WinKuDesktopCheckbox 364 301 512 30 13
    ${NSD_SetText} $WinKuPathButton "安装位置                         默认位置  >"
  ${EndIf}
FunctionEnd

Function WinKuBrowse
  Pop $0
  ${NSD_GetText} $WinKuPathInput $0
  nsDialogs::SelectFolderDialog "选择 WinKu 安装位置" "$0"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $WinKuPathInput "$0"
  ${EndIf}
FunctionEnd

Function WinKuWelcomeLeave
  ${NSD_GetText} $WinKuPathInput $0
  ExpandEnvStrings $0 "$0"
  System::Call 'shlwapi::PathIsRelativeW(w r0) i.r1'
  ${If} $0 == ""
  ${OrIf} $1 <> 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "请选择完整的 Windows 安装路径。"
    Abort
  ${EndIf}
  StrCpy $INSTDIR "$0"
  ${GetRoot} "$INSTDIR" $1
  ${If} $INSTDIR == "$1"
  ${OrIf} $INSTDIR == "$1\"
    MessageBox MB_OK|MB_ICONEXCLAMATION "请选择磁盘内的一个文件夹，不要直接安装到磁盘根目录。"
    Abort
  ${EndIf}
  ClearErrors
  CreateDirectory "$INSTDIR"
  GetTempFileName $0 "$INSTDIR"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONEXCLAMATION "无法写入安装目录，请选择其他位置后重试。"
    Abort
  ${EndIf}
  Delete "$0"
  ${NSD_GetState} $WinKuDesktopCheckbox $WinKuDesktopState
FunctionEnd

Function WinKuInstFilesShow
  FindWindow $WinKuDialog "#32770" "" $HWNDPARENT
  WinKuInstaller::Page /NOUNLOAD "$WinKuDialog" "installing"
FunctionEnd

Function WinKuFinish
  Call SkipIfPassive
  nsDialogs::Create 1018
  Pop $WinKuDialog
  ${NSD_CreateCheckbox} 0 0 0 0 "完成后启动 WinKu"
  Pop $WinKuLaunchCheckbox
  !insertmacro WinKuPlace $WinKuLaunchCheckbox 364 337 512 30 13
  ${NSD_SetState} $WinKuLaunchCheckbox $WinKuLaunchState
  ${NSD_OnClick} $WinKuLaunchCheckbox WinKuLaunchToggle
  Call WinKuCommon
  WinKuInstaller::Page /NOUNLOAD "$WinKuDialog" "complete"
  nsDialogs::Show
FunctionEnd

Function WinKuLaunchToggle
  Pop $0
  ${NSD_GetState} $WinKuLaunchCheckbox $WinKuLaunchState
  GetDlgItem $0 $HWNDPARENT 1
  ${If} $WinKuLaunchState == ${BST_CHECKED}
    SendMessage $0 ${WM_SETTEXT} 0 "STR:开始使用"
  ${Else}
    SendMessage $0 ${WM_SETTEXT} 0 "STR:完成"
  ${EndIf}
FunctionEnd

Function WinKuFinishLeave
  ${NSD_GetState} $WinKuLaunchCheckbox $WinKuLaunchState
  ${If} $WinKuLaunchState == ${BST_CHECKED}
    Call RunMainBinary
  ${EndIf}
FunctionEnd

Function .onInstFailed
  SetAutoClose false
  IfSilent +2
    WinKuInstaller::Failure /NOUNLOAD "$INSTDIR"
FunctionEnd
!macroend
