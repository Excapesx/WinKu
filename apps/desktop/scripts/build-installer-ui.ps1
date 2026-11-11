$ErrorActionPreference = 'Stop'
$desktopRoot = Split-Path $PSScriptRoot -Parent
$sourceRoot = Join-Path $desktopRoot 'src-tauri\installer'
$pluginRoot = Join-Path $sourceRoot 'plugins'
$objectRoot = Join-Path $desktopRoot '.tools\installer'
New-Item -ItemType Directory -Force $pluginRoot, $objectRoot | Out-Null
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $installation) { throw 'Visual C++ build tools are required to build the native installer UI.' }
$vcvars = Join-Path $installation 'VC\Auxiliary\Build\vcvarsall.bat'
$compile = 'cl /nologo /std:c++17 /utf-8 /MT /LD /O2 /EHsc "{0}" /Fo"{1}\WinKuInstaller.obj" /link /DEF:"{2}" /OUT:"{3}\WinKuInstaller.dll" /IMPLIB:"{1}\WinKuInstaller.lib"' -f (Join-Path $sourceRoot 'WinKuInstaller.cpp'), $objectRoot, (Join-Path $sourceRoot 'WinKuInstaller.def'), $pluginRoot
$batch = Join-Path $objectRoot 'compile.cmd'
@('@echo off', ('call "{0}" x86 >nul' -f $vcvars), 'if errorlevel 1 exit /b %errorlevel%', $compile) | Set-Content -LiteralPath $batch -Encoding ascii
& $env:ComSpec /d /c $batch
if ($LASTEXITCODE -ne 0) { throw 'Native installer UI compilation failed.' }
node (Join-Path $PSScriptRoot 'generate-installer-template.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Installer template preparation failed.' }
