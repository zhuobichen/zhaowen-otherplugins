# Pack the literature-map plugin into dist/litmap-<version>.xpi
$ErrorActionPreference = "Stop"
$manifest = Get-Content "manifest.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$outName = "litmap-$version.xpi"

New-Item -ItemType Directory -Force -Path "dist" | Out-Null
$dist = (Resolve-Path "dist").Path
if (Test-Path (Join-Path $dist $outName)) { Remove-Item (Join-Path $dist $outName) -Force }

$tmp = Join-Path $env:TEMP ("litmap_pack_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Copy-Item "manifest.json" $tmp
Copy-Item "bootstrap.js" $tmp
if (Test-Path "chrome") { Copy-Item "chrome" $tmp -Recurse }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $tmp, (Join-Path $dist $outName),
  [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item $tmp -Recurse -Force

Write-Host "Packed: dist/$outName"
