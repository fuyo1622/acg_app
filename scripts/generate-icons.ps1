param(
  [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'public')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-AppIcon {
  param(
    [int]$Size,
    [string]$FileName
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  try {
    $canvas = [System.Drawing.RectangleF]::new(0, 0, $Size, $Size)
    $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      $canvas,
      [System.Drawing.ColorTranslator]::FromHtml('#0F172A'),
      [System.Drawing.ColorTranslator]::FromHtml('#312E81'),
      45
    )
    $graphics.FillRectangle($background, $canvas)
    $background.Dispose()

    $haloBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(35, 99, 102, 241))
    $graphics.FillEllipse($haloBrush, $Size * 0.12, $Size * 0.10, $Size * 0.76, $Size * 0.76)
    $haloBrush.Dispose()

    $backCard = New-RoundedRectanglePath -X ($Size * 0.235) -Y ($Size * 0.205) -Width ($Size * 0.53) -Height ($Size * 0.55) -Radius ($Size * 0.075)
    $backBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#6366F1'))
    $graphics.FillPath($backBrush, $backCard)
    $backBrush.Dispose()
    $backCard.Dispose()

    $frontCard = New-RoundedRectanglePath -X ($Size * 0.205) -Y ($Size * 0.245) -Width ($Size * 0.59) -Height ($Size * 0.55) -Radius ($Size * 0.075)
    $frontBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#111827'))
    $frontPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 226, 232, 240), [Math]::Max(2, $Size * 0.012))
    $graphics.FillPath($frontBrush, $frontCard)
    $graphics.DrawPath($frontPen, $frontCard)
    $frontBrush.Dispose()
    $frontPen.Dispose()
    $frontCard.Dispose()

    $imagePanel = New-RoundedRectanglePath -X ($Size * 0.265) -Y ($Size * 0.315) -Width ($Size * 0.47) -Height ($Size * 0.255) -Radius ($Size * 0.04)
    $panelBounds = [System.Drawing.RectangleF]::new($Size * 0.265, $Size * 0.315, $Size * 0.47, $Size * 0.255)
    $panelBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      $panelBounds,
      [System.Drawing.ColorTranslator]::FromHtml('#22D3EE'),
      [System.Drawing.ColorTranslator]::FromHtml('#A855F7'),
      20
    )
    $graphics.FillPath($panelBrush, $imagePanel)
    $panelBrush.Dispose()
    $imagePanel.Dispose()

    $sparkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
    $sparkPoints = [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new($Size * 0.50, $Size * 0.345),
      [System.Drawing.PointF]::new($Size * 0.53, $Size * 0.405),
      [System.Drawing.PointF]::new($Size * 0.60, $Size * 0.435),
      [System.Drawing.PointF]::new($Size * 0.53, $Size * 0.465),
      [System.Drawing.PointF]::new($Size * 0.50, $Size * 0.525),
      [System.Drawing.PointF]::new($Size * 0.47, $Size * 0.465),
      [System.Drawing.PointF]::new($Size * 0.40, $Size * 0.435),
      [System.Drawing.PointF]::new($Size * 0.47, $Size * 0.405)
    )
    $graphics.FillPolygon($sparkBrush, $sparkPoints)
    $sparkBrush.Dispose()

    $lineBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(210, 226, 232, 240))
    $graphics.FillRectangle($lineBrush, $Size * 0.31, $Size * 0.625, $Size * 0.38, $Size * 0.034)
    $graphics.FillRectangle($lineBrush, $Size * 0.31, $Size * 0.69, $Size * 0.24, $Size * 0.028)
    $lineBrush.Dispose()

    $chipBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F472B6'))
    $graphics.FillEllipse($chipBrush, $Size * 0.60, $Size * 0.68, $Size * 0.045, $Size * 0.045)
    $chipBrush.Dispose()

    $outputPath = Join-Path $resolvedOutput $FileName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$svg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title">
  <title id="title">ACG Collector</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#312e81"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="246" r="195" fill="#6366f1" opacity=".14"/>
  <rect x="120" y="105" width="272" height="282" rx="38" fill="#6366f1"/>
  <rect x="105" y="125" width="302" height="282" rx="38" fill="#111827" stroke="#e2e8f0" stroke-width="6"/>
  <rect x="136" y="161" width="240" height="131" rx="20" fill="url(#panel)"/>
  <path d="m256 177 15 31 36 15-36 15-15 31-15-31-36-15 36-15Z" fill="#fff" opacity=".94"/>
  <rect x="159" y="320" width="194" height="17" rx="8.5" fill="#e2e8f0"/>
  <rect x="159" y="353" width="123" height="14" rx="7" fill="#e2e8f0"/>
  <circle cx="319" cy="364" r="12" fill="#f472b6"/>
</svg>
'@

[System.IO.File]::WriteAllText(
  (Join-Path $resolvedOutput 'favicon.svg'),
  $svg,
  [System.Text.UTF8Encoding]::new($false)
)

New-AppIcon -Size 180 -FileName 'apple-touch-icon.png'
New-AppIcon -Size 192 -FileName 'pwa-192x192.png'
New-AppIcon -Size 512 -FileName 'pwa-512x512.png'
New-AppIcon -Size 512 -FileName 'pwa-maskable-512x512.png'

Write-Output "Generated original app icons in $resolvedOutput"
