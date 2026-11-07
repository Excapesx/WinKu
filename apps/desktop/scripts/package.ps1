$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:CARGO_BUILD_JOBS='2'
node scripts/prepare-engine.mjs
if ($LASTEXITCODE -ne 0) { throw 'Engine preparation failed' }
npx tauri build --bundles nsis
if ($LASTEXITCODE -ne 0) { throw 'Desktop packaging failed' }
New-Item -ItemType Directory -Force out | Out-Null
$installer=Get-ChildItem src-tauri/target/release/bundle/nsis/*-setup.exe | Select-Object -First 1
if (-not $installer) { throw 'Installer was not generated' }
Copy-Item -LiteralPath $installer.FullName -Destination out/WinKu-v1.0-Windows-x64-setup.exe -Force
Write-Output (Get-Item out/WinKu-v1.0-Windows-x64-setup.exe).FullName
