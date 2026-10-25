Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BrandTitleProcessor
{
    private static double SmoothInk(double avg)
    {
        if (avg >= 246) return 0;
        if (avg <= 86) return 1;
        double t = (avg - 86) / 90.0;
        if (t <= 0) return 1;
        if (t >= 1) return 0;
        double s = t * t * (3 - 2 * t);
        return 1 - s;
    }

    private static double SmoothShadow(double avg)
    {
        if (avg >= 248) return 0;
        if (avg <= 128) return 0;
        if (avg >= 222)
        {
            double t = (avg - 222) / 26.0;
            return Math.Max(0, 0.14 * (1 - t));
        }
        double mid = (avg - 128) / 94.0;
        return 0.06 + (0.14 * (1 - mid));
    }

    private static Bitmap Upscale(Bitmap src, int factor)
    {
        int w = src.Width * factor;
        int h = src.Height * factor;
        var outBmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(outBmp))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.DrawImage(src, 0, 0, w, h);
        }
        return outBmp;
    }

    private static byte[] ReadAlphas(Bitmap bmp)
    {
        var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
        var data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int len = Math.Abs(data.Stride) * bmp.Height;
        byte[] raw = new byte[len];
        Marshal.Copy(data.Scan0, raw, 0, len);
        bmp.UnlockBits(data);
        byte[] alphas = new byte[bmp.Width * bmp.Height];
        for (int y = 0; y < bmp.Height; y++)
        {
            int row = y * data.Stride;
            for (int x = 0; x < bmp.Width; x++)
            {
                int i = row + x * 4;
                byte b = raw[i];
                byte g = raw[i + 1];
                byte r = raw[i + 2];
                alphas[y * bmp.Width + x] = (byte)((r + g + b) / 3);
            }
        }
        return alphas;
    }

    private static void BlurAlphas(byte[] alphas, int w, int h, int radius)
    {
        byte[] tmp = new byte[alphas.Length];
        int d = radius * 2 + 1;
        for (int y = 0; y < h; y++)
        {
            int sum = 0;
            for (int x = -radius; x <= radius; x++)
            {
                int cx = Math.Min(w - 1, Math.Max(0, x));
                sum += alphas[y * w + cx];
            }
            for (int x = 0; x < w; x++)
            {
                tmp[y * w + x] = (byte)(sum / d);
                int x0 = x - radius;
                int x1 = x + radius + 1;
                if (x0 >= 0) sum -= alphas[y * w + x0];
                if (x1 < w) sum += alphas[y * w + x1];
            }
        }
        for (int x = 0; x < w; x++)
        {
            int sum = 0;
            for (int y = -radius; y <= radius; y++)
            {
                int cy = Math.Min(h - 1, Math.Max(0, y));
                sum += tmp[cy * w + x];
            }
            for (int y = 0; y < h; y++)
            {
                alphas[y * w + x] = (byte)(sum / d);
                int y0 = y - radius;
                int y1 = y + radius + 1;
                if (y0 >= 0) sum -= tmp[y0 * w + x];
                if (y1 < h) sum += tmp[y1 * w + x];
            }
        }
    }

    private static void WriteBitmap(Bitmap bmp, byte[] alphas)
    {
        var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
        var data = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        int len = Math.Abs(data.Stride) * bmp.Height;
        byte[] raw = new byte[len];
        for (int y = 0; y < bmp.Height; y++)
        {
            int row = y * data.Stride;
            for (int x = 0; x < bmp.Width; x++)
            {
                int a = alphas[y * bmp.Width + x];
                if (a <= 0) continue;
                int i = row + x * 4;
                raw[i] = 0;
                raw[i + 1] = 0;
                raw[i + 2] = 0;
                raw[i + 3] = (byte)a;
            }
        }
        Marshal.Copy(raw, 0, data.Scan0, len);
        bmp.UnlockBits(data);
    }

    public static void Process(string srcPath, string dstPath, string brandPath, int scale)
    {
        using (var src = new Bitmap(srcPath))
        using (var up = Upscale(src, scale))
        {
            int w = up.Width;
            int h = up.Height;
            int offsetX = Math.Max(2, (int)(w * 0.012));
            int offsetY = Math.Max(3, (int)(h * 0.034));
            int pad = Math.Max(8, (int)(w * 0.03));
            int cw = w + pad * 2 + offsetX;
            int ch = h + pad * 2 + offsetY;
            byte[] lum = ReadAlphas(up);

            byte[] ink = new byte[cw * ch];
            byte[] shadow = new byte[cw * ch];
            int minX = cw, minY = ch, maxX = 0, maxY = 0;

            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    double avg = lum[y * w + x];
                    int inkA = (int)(255 * SmoothInk(avg));
                    int ix = x + pad;
                    int iy = y + pad;

                    if (inkA >= 8)
                    {
                        ink[iy * cw + ix] = (byte)Math.Min(255, inkA);
                        int sx = ix + offsetX;
                        int sy = iy + offsetY;
                        byte sh = (byte)Math.Min(255, inkA * 36 / 100);
                        if (sh > shadow[sy * cw + sx]) shadow[sy * cw + sx] = sh;
                        if (ix < minX) minX = ix;
                        if (iy < minY) minY = iy;
                        if (sx > maxX) maxX = sx;
                        if (sy > maxY) maxY = sy;
                    }
                }
            }

            BlurAlphas(shadow, cw, ch, 3);

            byte[] outA = new byte[cw * ch];
            for (int i = 0; i < outA.Length; i++)
            {
                int inkV = ink[i];
                int sh = shadow[i];
                if (inkV >= 20) outA[i] = (byte)inkV;
                else if (sh > 0) outA[i] = (byte)Math.Min(255, sh * 62 / 100);
            }

            using (var canvas = new Bitmap(cw, ch, PixelFormat.Format32bppArgb))
            {
                WriteBitmap(canvas, outA);
                int cropPad = Math.Max(4, (int)(w * 0.012));
                minX = Math.Max(0, minX - cropPad);
                minY = Math.Max(0, minY - cropPad);
                maxX = Math.Min(cw - 1, maxX + cropPad);
                maxY = Math.Min(ch - 1, maxY + cropPad);
                int rw = maxX - minX + 1;
                int rh = maxY - minY + 1;
                using (var crop = new Bitmap(rw, rh, PixelFormat.Format32bppArgb))
                {
                    using (var g = Graphics.FromImage(crop))
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.DrawImage(canvas, 0, 0, new Rectangle(minX, minY, rw, rh), GraphicsUnit.Pixel);
                    }
                    crop.Save(dstPath, ImageFormat.Png);
                    crop.Save(brandPath, ImageFormat.Png);
                }
            }
        }
    }
}
'@ -ReferencedAssemblies System.Drawing

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcPath = Join-Path $dir 'zaglavie-source.png'
if (-not (Test-Path $srcPath)) {
  $zaglavie = Get-ChildItem -Path $dir -Filter '*.png' | Where-Object { $_.Length -eq 38781 } | Select-Object -First 1
  if ($zaglavie) { $srcPath = $zaglavie.FullName }
}
$dstPath = Join-Path $dir 'brand-title-composed.png'
$brandPath = Join-Path $dir 'brand-title.png'

if (-not (Test-Path $srcPath)) {
  Write-Error "Source not found: $srcPath"
  exit 1
}

[BrandTitleProcessor]::Process($srcPath, $dstPath, $brandPath, 3)
Write-Host "Saved: $dstPath"
Write-Host 'OK'
