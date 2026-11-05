param(
    [ValidateSet('App', 'Learning', 'Android')][string]$Mode = 'App',
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkRoot = Join-Path $projectRoot 'toolchains/local/android-sdk'
$jdkRoot = Join-Path $projectRoot 'toolchains/local/jdk/jdk-21.0.13.0.2+1'

if ($Mode -eq 'App') {
    $previewUrl = 'http://127.0.0.1:4174/'
    $running = try { (Invoke-RestMethod "${previewUrl}api/status" -TimeoutSec 2).app -eq 'dsh-ultra-native-preview' } catch { $false }
    if (!$running) {
        $env:ANDROID_HOME = $sdkRoot
        $env:JAVA_HOME = $jdkRoot
        $adb = Join-Path $sdkRoot 'platform-tools/adb.exe'
        $state = & $adb -s emulator-5554 get-state 2>$null
        if ($state -ne 'device') {
            Start-Process -FilePath (Join-Path $sdkRoot 'emulator/emulator.exe') -ArgumentList @('-avd','dsh-learning-test','-no-window','-no-audio','-no-boot-anim','-gpu','swiftshader_indirect','-no-snapshot','-memory','2048') -WindowStyle Hidden
            $deadline = [DateTime]::UtcNow.AddSeconds(45)
            do {
                Start-Sleep -Milliseconds 500
                $boot = & $adb -s emulator-5554 shell getprop sys.boot_completed 2>$null
            } until ($boot -eq '1' -or [DateTime]::UtcNow -gt $deadline)
            if ($boot -ne '1') { throw 'Development emulator did not boot in time.' }
        }
        Push-Location $projectRoot
        try {
            & .\gradlew.bat :app:assembleDebug '-Pdsh.learningPreview=true' '-Pdsh.fetchShizuku=false' --offline --console=plain
            if ($LASTEXITCODE -ne 0) { throw 'Native preview build failed.' }
            & $adb -s emulator-5554 install -r (Join-Path $projectRoot 'app/build/outputs/apk/debug/app-debug.apk')
            if ($LASTEXITCODE -ne 0) { throw 'Native preview install failed.' }
            & $adb -s emulator-5554 shell am start -W -n io.github.jackwener.dsh.learning.preview/io.github.jackwener.dsh.MainActivity
            $node = (Get-Command node).Source
            Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $projectRoot 'tools/app-preview-server.mjs') + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden
        } finally { Pop-Location }
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        do {
            Start-Sleep -Milliseconds 300
            $running = try { (Invoke-RestMethod "${previewUrl}api/status" -TimeoutSec 2).app -eq 'dsh-ultra-native-preview' } catch { $false }
        } until ($running -or [DateTime]::UtcNow -gt $deadline)
        if (!$running) { throw 'Native preview server did not start.' }
    }
    if (!$NoBrowser) { Start-Process $previewUrl }
    Write-Output $previewUrl
    return
}

if ($Mode -eq 'Android') {
    $studioCandidates = @('D:\Program Files\Android\Android Studio\bin\studio64.exe',
        (Join-Path $env:ProgramFiles 'Android/Android Studio/bin/studio64.exe'))
    $studio = $studioCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (!$studio) { throw 'Android Studio is not installed. See docs/LIVE-UI-PREVIEW.zh-CN.md.' }
    if (!(Test-Path -LiteralPath $sdkRoot) -or !(Test-Path -LiteralPath $jdkRoot)) { throw 'Project-local Android SDK or JDK is missing.' }
    $env:ANDROID_HOME = $sdkRoot
    $env:JAVA_HOME = $jdkRoot
    # Only Studio launched here inherits the renderer-only x86_64 profile.
    # The normal arm64 build and its package ID retain their existing settings.
    [Environment]::SetEnvironmentVariable('ORG_GRADLE_PROJECT_dsh.learningPreview', 'true', 'Process')
    [Environment]::SetEnvironmentVariable('ORG_GRADLE_PROJECT_dsh.fetchShizuku', 'false', 'Process')
    $previewFile = Join-Path $projectRoot 'app/src/debug/java/io/github/jackwener/dsh/feature/conversation/ConversationPreviews.kt'
    Start-Process -FilePath $studio -ArgumentList @(('"' + $projectRoot + '"'), ('"' + $previewFile + '"'))
    Write-Output 'Opened DSH Ultra in Android Studio. Use Split to see the actual Compose conversation previews.'
    return
}

$previewUrl = 'http://127.0.0.1:4173/_preview?width=390&demo=function'
$statusUrl = 'http://127.0.0.1:4173/__dev/status'
function Test-Preview {
    try { return (Invoke-RestMethod -Uri $statusUrl -TimeoutSec 2).app -eq 'dsh-ultra-learning-preview' }
    catch { return $false }
}
if (!(Test-Preview)) {
    $logDir = Join-Path $projectRoot 'toolchains/out/learning-dev'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $node = (Get-Command node -ErrorAction Stop).Source
    $serverScript = Join-Path $projectRoot 'learning-ui/scripts/serve.mjs'
    $server = Start-Process -FilePath $node -ArgumentList ('"' + $serverScript + '"') -WindowStyle Hidden -PassThru `
        -WorkingDirectory (Join-Path $projectRoot 'learning-ui') `
        -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log')
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    while (!(Test-Preview)) {
        if ($server.HasExited -or [DateTime]::UtcNow -gt $deadline) { throw "Preview did not start. See $logDir/server-error.log" }
        Start-Sleep -Milliseconds 300
    }
}
if (!$NoBrowser) { Start-Process $previewUrl }
Write-Output $previewUrl
Write-Output 'Save files in learning-ui/src to rebuild and refresh the preview automatically.'
