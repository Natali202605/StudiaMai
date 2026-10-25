Add-Type -AssemblyName System.Drawing

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$refPath = Join-Path $dir 'reference-mai.png'
$srcPath = Join-Path $dir 'brand-title.png'

function Get-ButterflyBBox($bmp) {
  $minX = $bmp.Width
  $maxX = 0
  $minY = $bmp.Height
  $maxY = 0
  for ($y = 0; $y -lt 74; $y++) {
    for ($x = 1010; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $avg = ($c.R + $c.G + $c.B) / 3
      if ($avg -lt 110) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -le $minX) {
    return @{ minX = 1024; maxX = 1126; minY = 2; maxY = 48 }
  }
  return @{ minX = $minX; maxX = $maxX; minY = $minY; maxY = $maxY }
}

function Should-RemoveButterflyPixel($x, $y, $avg) {
  if ($avg -ge 168) { return $false }
  if ($y -le 54 -and $x -ge 1012) { return $true }
  if ($y -le 72 -and $x -ge 1048) { return $true }
  return $false
}

function Get-GlowSample($bmp, $y, $endX) {
  $best = $bmp.GetPixel([Math]::Max(0, $endX - 1), $y)
  $bestScore = ($best.R + $best.G + $best.B)
  $startX = [Math]::Max(0, $endX - 120)
  for ($x = $startX; $x -lt $endX; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $score = ($c.R + $c.G + $c.B)
    if ($score -gt $bestScore) {
      $best = $c
      $bestScore = $score
    }
  }
  return $best
}

function Clean-BrandTitle([string]$src, [string]$dst) {
  $bmp = [System.Drawing.Bitmap]::FromFile($src)
  $out = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $avg = ($c.R + $c.G + $c.B) / 3
      if (Should-RemoveButterflyPixel $x $y $avg) {
        $c = Get-GlowSample $bmp $y 1010
      }
      $out.SetPixel($x, $y, $c)
    }
  }
  $out.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $out.Dispose()
}

function Remove-WhiteBgBitmap($bmp) {
  $out = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $avg = ($c.R + $c.G + $c.B) / 3
      if ($avg -gt 212) { continue }
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
    }
  }
  return $out
}

function Crop-ButterflyFromRef([string]$src) {
  $ref = [System.Drawing.Bitmap]::FromFile($src)
  $minX = $ref.Width
  $maxX = 0
  $minY = $ref.Height
  $maxY = 0
  $yLimit = [int]($ref.Height * 0.34)
  $xStart = [int]($ref.Width * 0.66)
  for ($y = 0; $y -lt $yLimit; $y++) {
    for ($x = $xStart; $x -lt $ref.Width; $x++) {
      $c = $ref.GetPixel($x, $y)
      $avg = ($c.R + $c.G + $c.B) / 3
      if ($avg -lt 205) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $pad = 8
  $minX = [Math]::Max(0, $minX - $pad)
  $minY = [Math]::Max(0, $minY - $pad)
  $maxX = [Math]::Min($ref.Width - 1, $maxX + $pad)
  $maxY = [Math]::Min($ref.Height - 1, $maxY + $pad)
  $w = $maxX - $minX + 1
  $h = $maxY - $minY + 1
  $crop = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($ref, 0, 0, (New-Object System.Drawing.Rectangle($minX, $minY, $w, $h)), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $ref.Dispose()
  $clear = Remove-WhiteBgBitmap $crop
  $crop.Dispose()
  $clear.Save((Join-Path $dir 'butterfly-outline.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $clear.Dispose()
}

if (-not (Test-Path $refPath)) {
  Write-Error 'reference-mai.png not found'
  exit 1
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$bbox = Get-ButterflyBBox $srcBmp
$srcBmp.Dispose()
Write-Host "BBox: x=$($bbox.minX)-$($bbox.maxX) y=$($bbox.minY)-$($bbox.maxY)"

Crop-ButterflyFromRef $refPath
Clean-BrandTitle $srcPath (Join-Path $dir 'brand-title-text.png')
Write-Host 'OK'
