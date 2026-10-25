Add-Type -AssemblyName System.Drawing
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bmp = [System.Drawing.Bitmap]::FromFile((Join-Path $dir 'brand-title.png'))
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 0; $y -lt 80; $y++) {
  for ($x = 1020; $x -lt $bmp.Width; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $avg = ($c.R + $c.G + $c.B) / 3
    if ($avg -lt 85) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$w = $bmp.Width; $h = $bmp.Height
Write-Host "Butterfly top bbox: x=$minX-$maxX y=$minY-$maxY"
$top = [math]::Round($minY / $h * 100, 2)
$right = [math]::Round(($w - $maxX - 1) / $w * 100, 2)
$width = [math]::Round(($maxX - $minX + 1) / $w * 100, 2)
$height = [math]::Round(($maxY - $minY + 1) / $h * 100, 2)
Write-Host "CSS: top=${top}% right=${right}% width=${width}% height=${height}%"
$bmp.Dispose()
