param([string]$Serial = 'emulator-5554')
$ErrorActionPreference = 'Stop'
if (!$Serial.StartsWith('emulator-')) { throw 'This review script only operates on a task-owned emulator.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$adb = Join-Path $projectRoot 'toolchains/local/android-sdk/platform-tools/adb.exe'
$captureDir = Join-Path $projectRoot '.impeccable/review/screenshots'
$dumpFile = Join-Path $projectRoot 'toolchains/local/capture-ui.xml'
New-Item -ItemType Directory -Force -Path $captureDir | Out-Null
$script:dumpNumber = 0
function Wait-Node([string]$label) {
    $until = [DateTime]::UtcNow.AddSeconds(25)
    while ([DateTime]::UtcNow -lt $until) {
        $script:dumpNumber++
        $remote = "/sdcard/learning-capture-$($script:dumpNumber).xml"
        $result = & $adb -s $Serial shell uiautomator dump $remote 2>$null
        if ($result -match 'dumped') {
            & $adb -s $Serial pull $remote $dumpFile 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                [xml]$tree = Get-Content -LiteralPath $dumpFile -Raw
                $node = $tree.SelectNodes('//node') | Where-Object { ($_.text -eq $label -or $_.'content-desc' -eq $label) -and $_.bounds -ne '[0,0][0,0]' } | Select-Object -First 1
                if ($node) { return $node }
            }
        }
        Start-Sleep -Milliseconds 200
    }
    throw "Native control did not appear: $label"
}
function Tap-Node($node) {
    $coordinates = [regex]::Matches($node.bounds, '\d+') | ForEach-Object { [int]$_.Value }
    & $adb -s $Serial shell input tap ([int](($coordinates[0]+$coordinates[2])/2)) ([int](($coordinates[1]+$coordinates[3])/2))
}
function Capture([string]$name) {
    & $adb -s $Serial shell screencap -p /sdcard/learning-review.png
    & $adb -s $Serial pull /sdcard/learning-review.png (Join-Path $captureDir "$name.png") 2>$null | Out-Null
    Write-Output "Captured $name"
}
try {
    & $adb -s $Serial shell wm size 390x844
    & $adb -s $Serial shell wm density 160
    & $adb -s $Serial shell settings put system font_scale 1.0
    & $adb -s $Serial shell cmd uimode night no
    & $adb -s $Serial shell cmd locale set-app-locales io.github.jackwener.dsh.learning.preview --locales zh-CN
    & $adb -s $Serial shell am force-stop io.github.jackwener.dsh.learning.preview
    & $adb -s $Serial shell am start -W -n io.github.jackwener.dsh.learning.preview/io.github.jackwener.dsh.MainActivity --ez learning_gallery true | Out-Null
    Wait-Node '全屏查看' | Out-Null
    Capture 'phone-light'
    Tap-Node (Wait-Node '全屏查看')
    Wait-Node '双指缩放，单指移动' | Out-Null
    Capture 'phone-fullscreen'
    & $adb -s $Serial shell input keyevent 4
    Wait-Node '全屏查看' | Out-Null
    & $adb -s $Serial shell cmd uimode night yes
    Wait-Node '全屏查看' | Out-Null
    Capture 'phone-dark'
    & $adb -s $Serial shell settings put system font_scale 1.3
    Wait-Node '全屏查看' | Out-Null
    Capture 'phone-large-text'
    & $adb -s $Serial shell settings put system font_scale 1.0
    & $adb -s $Serial shell cmd uimode night no
    Tap-Node (Wait-Node '小测验')
    Wait-Node '检查答案' | Out-Null
    Capture 'phone-quiz'
    Tap-Node (Wait-Node '流程图')
    Wait-Node '放大流程图' | Out-Null
    Capture 'phone-diagram'
} finally {
    & $adb -s $Serial shell settings put system font_scale 1.0
    & $adb -s $Serial shell cmd uimode night no
    & $adb -s $Serial shell wm size reset
    & $adb -s $Serial shell wm density reset
}
