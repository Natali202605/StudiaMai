$ErrorActionPreference = 'Stop'
function ConsentIsTrue($value) { return $value -is [bool] -and $value -eq $true }
function NormalizePhone($value) {
  $digits = ([string]$value) -replace '\D', ''
  if ($digits.Length -eq 11 -and ($digits.StartsWith('7') -or $digits.StartsWith('8'))) { return '+7' + $digits.Substring(1) }
  if ($digits.Length -eq 10) { return '+7' + $digits }
  return ''
}
if (-not (ConsentIsTrue $true)) { throw 'true must pass' }
if (ConsentIsTrue 'false') { throw 'string false must fail' }
if (ConsentIsTrue 'true') { throw 'string true must fail' }
if ((NormalizePhone '8 (902) 000-00-00') -ne '+79020000000') { throw 'phone' }
if ((NormalizePhone '123') -ne '') { throw 'short phone' }
$live = Get-Content -LiteralPath 'js\live-store.js' -Raw -Encoding UTF8
if ($live -match 'access_token' -or $live -match 'formsubmit' -or $live -match 'telegra\.ph') { throw 'public store still calls external writer' }
$api = Get-Content -LiteralPath 'js\site-api.js' -Raw -Encoding UTF8
if ($api -match 'formsubmit|web3forms|api\.telegram|bookingsApiUrl') { throw 'browser still posts bookings to a third party' }
$html = Get-Content -LiteralPath 'index.html' -Raw -Encoding UTF8
if ($html -match 'fonts\.googleapis') { throw 'google fonts still preload' }
$admin = Get-Content -LiteralPath 'admin\index.html' -Raw -Encoding UTF8
if ($admin -match 'recover_pass' -or $admin -match 'formsubmit') { throw 'admin still resets a password or posts to a form service' }
$server = Get-Content -LiteralPath 'server\server.js' -Raw -Encoding UTF8
if ($server -match 'express\.static\(ROOT\)') { throw 'server still serves the project root' }
if ($server -notmatch 'assertRuntimeSecrets') { throw 'server can start without secrets' }
if ($api -notmatch 'intake\.json') { throw 'intake flag is not read' }
Write-Output 'intake-policy.ps1: ok'
