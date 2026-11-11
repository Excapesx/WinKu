$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:CARGO_BUILD_JOBS='2'
if ($env:GITHUB_ACTIONS -eq 'true' -and -not $env:TAURI_SIGNING_PRIVATE_KEY) {
  $env:WINKU_ALLOW_UNSIGNED_TEST_BUILD = '1'
}
$localUpdateKey = Join-Path $env:USERPROFILE '.winku-signing/windows-updater.key'
if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and (Test-Path -LiteralPath $localUpdateKey)) {
  $env:TAURI_SIGNING_PRIVATE_KEY = $localUpdateKey
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
}
if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and $env:WINKU_ALLOW_UNSIGNED_TEST_BUILD -ne '1') {
  throw 'A Windows update signing key is required. See docs/APP-UPDATES.md. Use WINKU_ALLOW_UNSIGNED_TEST_BUILD=1 only for CI validation.'
}
& (Join-Path $PSScriptRoot 'build-installer-ui.ps1')
node scripts/prepare-engine.mjs
if ($LASTEXITCODE -ne 0) { throw 'Engine preparation failed' }
if ($env:WINKU_BUILD_PYTHON) { & $env:WINKU_BUILD_PYTHON scripts/package-study-runtime.py }
else { py -3.12 scripts/package-study-runtime.py }
if ($LASTEXITCODE -ne 0) { throw 'Study runtime preparation failed' }
node scripts/sync-android-design.mjs
if ($LASTEXITCODE -ne 0) { throw 'Android design sync failed' }
npx tauri icon app-icon.svg --output .tools/generated-icons
if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed' }
Copy-Item -LiteralPath .tools/generated-icons/icon.ico -Destination src-tauri/icons/icon.ico -Force
Copy-Item -LiteralPath .tools/generated-icons/128x128.png -Destination src-tauri/icons/icon.png -Force
if ($env:TAURI_SIGNING_PRIVATE_KEY) { npx tauri build --bundles nsis }
else {
  $validationConfig = Join-Path (Get-Location) '.tools/validation-updater.json'
  New-Item -ItemType Directory -Force (Split-Path $validationConfig -Parent) | Out-Null
  [IO.File]::WriteAllText($validationConfig, '{"bundle":{"createUpdaterArtifacts":false}}', [Text.UTF8Encoding]::new($false))
  npx tauri build --bundles nsis --config $validationConfig
}
if ($LASTEXITCODE -ne 0) { throw 'Desktop packaging failed' }
New-Item -ItemType Directory -Force out | Out-Null
$packageVersion = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version
$installer = Get-Item -LiteralPath "src-tauri/target/release/bundle/nsis/WinKu_$($packageVersion)_x64-setup.exe"
if (-not $installer) { throw 'Installer was not generated' }
$testSuffix = if ($env:TAURI_SIGNING_PRIVATE_KEY) { '' } else { '-validation' }
$destination = "out/WinKu-v$packageVersion-Windows-x64$testSuffix-setup.exe"
Copy-Item -LiteralPath $installer.FullName -Destination $destination -Force
if ($env:TAURI_SIGNING_PRIVATE_KEY) { Copy-Item -LiteralPath ($installer.FullName + '.sig') -Destination ($destination + '.sig') -Force }
Write-Output (Get-Item -LiteralPath $destination).FullName
