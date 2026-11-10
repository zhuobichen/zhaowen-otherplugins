# Build the plugin into an installable .xpi.
#
# An .xpi is a plain zip with manifest.json at the root. PowerShell's
# Compress-Archive refuses a non-.zip extension, so the archive is produced as
# .zip and renamed -- that is the whole build.

$ErrorActionPreference = "Stop"
# The script lives at the repository root, so it is its own source directory.
$src = $PSScriptRoot
$dist = Join-Path $src "dist"
$name = "collection-tags"

# Read the version out of the manifest so the artefact name stays in sync.
$manifest = Get-Content (Join-Path $src "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

$stage = Join-Path $env:TEMP "collection-tags-build"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

# Copy only what the plugin needs; skip dist, .git and build scripts.
$items = @("manifest.json", "bootstrap.js", "chrome")
foreach ($item in $items) {
    $from = Join-Path $src $item
    if (Test-Path $from) {
        Copy-Item $from -Destination $stage -Recurse -Force
    }
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zipPath = Join-Path $stage "$name.zip"
$target = Join-Path $dist "$name-$version.xpi"
if (Test-Path $target) { Remove-Item $target -Force }

Push-Location $stage
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -Force
Pop-Location
Move-Item $zipPath $target -Force

Write-Host "built: $target"
Write-Host ("size : {0:N1} KB" -f ((Get-Item $target).Length / 1KB))
Write-Host ""
Write-Host "Install: Zotero -> Tools -> Add-ons -> gear icon -> Install Add-on From File"
