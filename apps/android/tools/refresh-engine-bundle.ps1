param(
    [string]$SourceEngineDirectory,
    [string]$OutputDirectory,
    [switch]$Install
)

# Refresh first-party JS files in an already built/patched engine without npm or bash.
# Dependency changes still require js/build-engine.sh. The original bundle is backed up on install.
$ErrorActionPreference = 'Stop'
$androidRoot = Split-Path $PSScriptRoot -Parent
if (!$SourceEngineDirectory) { $SourceEngineDirectory = Join-Path $androidRoot 'toolchains/out/engine' }
if (!$OutputDirectory) { $OutputDirectory = Join-Path $androidRoot 'build/winku-engine' }
$SourceEngineDirectory = [IO.Path]::GetFullPath($SourceEngineDirectory)
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if ($SourceEngineDirectory -eq $OutputDirectory) { throw 'Use a separate output directory; install copies only after verification.' }
$sourceZip = Join-Path $SourceEngineDirectory 'engine.zip'
$sourceHash = (Get-FileHash -LiteralPath $sourceZip -Algorithm SHA256).Hash.ToLowerInvariant()
$expectedHash = ((Get-Content (Join-Path $SourceEngineDirectory 'engine.sha256') -Raw).Trim() -split '\s+')[0]
if ($sourceHash -ne $expectedHash) { throw 'Source engine.zip checksum mismatch' }
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
$replacements = [Collections.Generic.Dictionary[string, byte[]]]::new([StringComparer]::Ordinal)
foreach ($package in @('bundle-android', 'plugin-device', 'plugin-guard', 'plugin-mode', 'plugin-extensions')) {
    $packageDirectory = Join-Path $androidRoot "js/packages/$package"
    $manifestPath = Join-Path $packageDirectory 'package.json'
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    foreach ($relative in (@('package.json') + $manifest.files | Select-Object -Unique)) {
        $file = Join-Path $packageDirectory $relative
        $files = if (Test-Path -LiteralPath $file -PathType Container) { Get-ChildItem -LiteralPath $file -Recurse -File } else { @(Get-Item -LiteralPath $file) }
        foreach ($entry in $files) {
            $suffix = [IO.Path]::GetRelativePath($packageDirectory, $entry.FullName).Replace('\', '/')
            $replacements["node_modules/$($manifest.name)/$suffix"] = [IO.File]::ReadAllBytes($entry.FullName)
        }
    }
}

$inputArchive = [IO.Compression.ZipFile]::OpenRead($sourceZip)
try {
    # Patches 01-22 are already in the source archive. Apply only the new, idempotent header policy.
    $adapterPath = 'node_modules/@snnh/dsh-llm-service-lite/lib/index.js'
    $reader = [IO.StreamReader]::new($inputArchive.GetEntry($adapterPath).Open())
    try { $adapter = $reader.ReadToEnd().Replace("`r", '') } finally { $reader.Dispose() }
    $headerChanges = @(
        @('if (!declaredAgent && profile.userAgent !== void 0) out["user-agent"] = `${profile.userAgent} ${out["user-agent"] ?? ""}`.trim();',
          'if (!declaredAgent && profile.userAgent !== void 0) out["user-agent"] = profile.userAgent;'),
        @('if (route.userAgent !== void 0) headers.set("user-agent", `${route.userAgent} ${headers.get("user-agent") ?? ""}`.trim());',
          'if (route.userAgent !== void 0) headers.set("user-agent", route.userAgent);')
    )
    foreach ($change in $headerChanges) {
        if ($adapter.Contains($change[0])) { $adapter = $adapter.Replace($change[0], $change[1]) }
        elseif (!$adapter.Contains($change[1])) { throw 'Unexpected adapter version: header policy cannot be applied safely.' }
    }
    $replacements[$adapterPath] = $utf8.GetBytes($adapter)
    $sdkPath = 'node_modules/@deepseek-ai/dsh-sdk-jsonrpc-server/lib/index.js'
    $reader = [IO.StreamReader]::new($inputArchive.GetEntry($sdkPath).Open())
    try { $sdk = $reader.ReadToEnd().Replace("`r", '') } finally { $reader.Dispose() }
    $sdkChanges = @(
        @('import * as LlmDeepSeek from "@deepseek-ai/dsh-llm-deepseek-api-key";', '// WinKu: model adapters come exclusively from the configured provider list.'),
        @('provider = "deepseek-official";', 'provider = "";'),
        @('model = "deepseek-official";', 'model = "";'),
        @("`t`tif (!this.hasAdapterFor(provider)) {`n`t`t`tif (provider !== `"deepseek-official`") throw new Error(``no adapter registered for provider `"`${provider}`"``);`n`t`t`tthis.llmFiber = await this.ctx.plugin(LlmDeepSeek);`n`t`t}",
          '`t`tif (!this.hasAdapterFor(provider)) throw new Error(`no adapter registered for provider "${provider}"`);'.Replace('`t', "`t")),
        @('name: "deepseek-harness-sdk-runtime",', 'name: "winku-harness-sdk-runtime",')
    )
    foreach ($change in $sdkChanges) {
        if ($sdk.Contains($change[0])) { $sdk = $sdk.Replace($change[0], $change[1]) }
        elseif (!$sdk.Contains($change[1])) { throw 'Unexpected SDK version: vendor fallback cannot be removed safely.' }
    }
    $replacements[$sdkPath] = $utf8.GetBytes($sdk)
    $reader = [IO.StreamReader]::new($inputArchive.GetEntry('package.json').Open())
    try { $enginePackage = $reader.ReadToEnd() | ConvertFrom-Json -AsHashtable } finally { $reader.Dispose() }
    $enginePackage.dependencies.Remove('@dsh-android/plugin-account') | Out-Null
    $enginePackage.description = 'WinKu Android harness, powered by the open-source dsh engine.'
    $replacements['package.json'] = $utf8.GetBytes(($enginePackage | ConvertTo-Json -Depth 50) + "`n")
    $hasher = [Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
    try {
        foreach ($key in ($replacements.Keys | Sort-Object)) { $hasher.AppendData($utf8.GetBytes($key)); $hasher.AppendData($replacements[$key]) }
        $inputVersion = [Convert]::ToHexString($hasher.GetHashAndReset()).ToLowerInvariant().Substring(0, 12)
    } finally { $hasher.Dispose() }
    $version = "winku-$inputVersion"
    $replacements['engine-version.txt'] = $utf8.GetBytes("$version`n")
    $partialZip = Join-Path $OutputDirectory 'engine.zip.partial'
    $stream = [IO.File]::Create($partialZip)
    $outputArchive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        $written = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($entry in ($inputArchive.Entries | Sort-Object FullName)) {
            if ($entry.FullName.StartsWith('node_modules/@dsh-android/plugin-account/')) { continue }
            $out = $outputArchive.CreateEntry($entry.FullName, [IO.Compression.CompressionLevel]::Optimal)
            $out.LastWriteTime = [DateTimeOffset]::new(2025, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
            $out.ExternalAttributes = $entry.ExternalAttributes
            $destination = $out.Open()
            try {
                if ($replacements.ContainsKey($entry.FullName)) { $destination.Write($replacements[$entry.FullName]) }
                else { $original = $entry.Open(); try { $original.CopyTo($destination) } finally { $original.Dispose() } }
            } finally { $destination.Dispose() }
            $written.Add($entry.FullName) | Out-Null
        }
        foreach ($name in ($replacements.Keys | Sort-Object)) {
            if ($written.Contains($name)) { continue }
            $out = $outputArchive.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
            $out.LastWriteTime = [DateTimeOffset]::new(2025, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
            $out.ExternalAttributes = -2119958528 # Unix regular file, mode 0644.
            $destination = $out.Open(); try { $destination.Write($replacements[$name]) } finally { $destination.Dispose() }
        }
    } finally { $outputArchive.Dispose() }
} finally { $inputArchive.Dispose() }

$outputZip = Join-Path $OutputDirectory 'engine.zip'
[IO.File]::Move($partialZip, $outputZip, $true)
$outputHash = (Get-FileHash -LiteralPath $outputZip -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'engine.sha256'), "$outputHash  engine.zip`n", $utf8)
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'engine-version.txt'), "$version`n", $utf8)
if ($Install) {
    $backupDirectory = Join-Path $androidRoot "build/engine-backups/$sourceHash"
    New-Item -ItemType Directory -Force $backupDirectory | Out-Null
    foreach ($name in @('engine.zip', 'engine.sha256', 'engine-version.txt')) {
        if (Test-Path (Join-Path $SourceEngineDirectory $name)) { Copy-Item -LiteralPath (Join-Path $SourceEngineDirectory $name) -Destination $backupDirectory }
        Copy-Item -LiteralPath (Join-Path $OutputDirectory $name) -Destination (Join-Path $SourceEngineDirectory $name)
    }
}
Write-Output "WinKu engine: $version ($outputHash)"
