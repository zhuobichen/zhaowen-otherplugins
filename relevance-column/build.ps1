# Pack the relevance-column plugin into dist/relevance-column-<version>.xpi
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
Push-Location $here
try {
  $manifest = Get-Content "manifest.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $version = $manifest.version
  $outName = "relevance-column-$version.xpi"

  # Same dist/ as the other plugins in this repo
  $dist = Join-Path (Split-Path $here -Parent) "dist"
  New-Item -ItemType Directory -Force -Path $dist | Out-Null
  $outPath = Join-Path $dist $outName
  if (Test-Path $outPath) { Remove-Item $outPath -Force }

  # Build the archive entry by entry so names always use forward slashes.
  # CreateFromDirectory / Compress-Archive emit backslashes on Windows, which is
  # not what the ZIP spec says and not what nsIZipReader.getEntry looks up.
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
  Write-Host ("size  : {0:N1} KB" -f ((Get-Item $outPath).Length / 1KB))
} finally {
  Pop-Location
}
