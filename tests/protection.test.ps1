$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding $false
$fail = 0
function Assert($name, $ok) {
  if ($ok) { Write-Output "ok $name" } else { Write-Output "FAIL $name"; $script:fail++ }
}
function Read-Text($path) {
  return $utf8.GetString([System.IO.File]::ReadAllBytes((Join-Path $root $path)))
}

$api = Read-Text 'js\site-api.js'
Assert 'email path closed' (-not $api.Contains('formsubmit.co/ajax'))
Assert 'local booking not appended on submit' (-not $api.Contains('appendLocalBooking(booking);'))
Assert 'web3forms removed' (-not $api.Contains('api.web3forms.com'))
Assert 'telegram send removed' (-not $api.Contains('api.telegram.org'))
Assert 'arbitrary booking url removed' (-not $api.Contains('config.bookingsApiUrl'))

$policy = Read-Text 'server\intake-policy.mjs'
Assert 'consent is strict' ($policy.Contains('return value === true'))
Assert 'private paths blocked' ($policy.Contains('db.json') -and $policy.Contains('.env'))

$server = Read-Text 'server\server.js'
Assert 'open registration closed' ($server.Contains('/api/auth/register') -and -not $server.Contains('register-disabled'))
Assert 'server refuses weak secrets' ($server.Contains('secretsReady') -and $server.Contains('process.exit(1)'))
Assert 'reviews require auth' ($server.Contains("app.post('/api/reviews', authMiddleware"))
Assert 'private middleware present' ($server.Contains('isPrivateRequestPath'))

$html = Read-Text 'index.html'
Assert 'form fields kept' ($html.Contains('name="surname"') -and $html.Contains('name="email"') -and $html.Contains('bookingComment'))

function Consent-Is-True($value) { return ($value -is [bool]) -and ($value -eq $true) }
Assert 'false string is not consent' (-not (Consent-Is-True 'false'))
Assert 'boolean false is not consent' (-not (Consent-Is-True $false))
Assert 'boolean true is consent' (Consent-Is-True $true)

if ($fail -gt 0) { exit 1 }
Write-Output 'protection checks ok'
