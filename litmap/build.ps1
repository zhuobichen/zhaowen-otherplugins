# Pack the literature-map plugin into dist/litmap-<version>.xpi
$ErrorActionPreference = "Stop"
$manifest = Get-Content "manifest.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$outName = "litmap-$version.xpi"

New-Item -ItemType Directory -Force -Path "dist" | Out-Null
$dist = (Resolve-Path "dist").Path
$outPath = Join-Path $dist $outName
if (Test-Path $outPath) { Remove-Item $outPath -Force }

# Build the archive entry by entry so names always use forward slashes.
# CreateFromDirectory emits backslashes on Windows, which is not what the ZIP
# spec says and not what nsIZipReader.getEntry looks up.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($outPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $files = @("manifest.json", "bootstrap.js")
  foreach ($extra in @("chrome", "content", "locale")) {
    if (Test-Path $extra) {
      $files += (Get-ChildItem $extra -Recurse -File | ForEach-Object {
        $_.FullName.Substring((Get-Location).Path.Length + 1)
      })
    }
  }
  foreach ($rel in $files) {
    $entryName = $rel -replace '\\', '/'
    $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $stream = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location).Path $rel))
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
  }
} finally {
  $zip.Dispose()
}

Write-Host "Packed: dist/$outName"
