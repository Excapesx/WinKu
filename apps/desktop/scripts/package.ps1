$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:CARGO_BUILD_JOBS='2'
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
npx tauri build --bundles nsis
if ($LASTEXITCODE -ne 0) { throw 'Desktop packaging failed' }
New-Item -ItemType Directory -Force out | Out-Null
$installer=Get-ChildItem src-tauri/target/release/bundle/nsis/*-setup.exe | Select-Object -First 1
if (-not $installer) { throw 'Installer was not generated' }
Copy-Item -LiteralPath $installer.FullName -Destination out/WinKu-v1.0-Windows-x64-setup.exe -Force
Write-Output (Get-Item out/WinKu-v1.0-Windows-x64-setup.exe).FullName
