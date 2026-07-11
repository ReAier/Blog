param(
  [switch]$DryRun,
  [string]$SshHost = 'aliyun-aiopt'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$File failed with exit code $LASTEXITCODE" }
}

Write-Host '[1/5] Checking content and types...'
Invoke-Checked 'npm.cmd' @('run', 'check')
Write-Host '[2/5] Running tests...'
Invoke-Checked 'npm.cmd' @('test', '--', '--run')
Write-Host '[3/5] Building production site...'
Invoke-Checked 'npm.cmd' @('run', 'build')

$release = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$deployDir = Join-Path $root '.deploy'
$archive = Join-Path $deployDir "aier-blog-$release.tar.gz"
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Invoke-Checked 'tar.exe' @('-czf', $archive, '-C', (Join-Path $root 'dist'), '.')

$remoteArchive = "/tmp/aier-blog-$release.tar.gz"
$remoteScript = @'
set -euo pipefail
BASE=/var/www/aier-blog
RELEASE='__RELEASE__'
ARCHIVE='__ARCHIVE__'
NEW="$BASE/releases/$RELEASE"
PREVIOUS="$(readlink -f "$BASE/current" 2>/dev/null || true)"
mkdir -p "$NEW"
tar -xzf "$ARCHIVE" -C "$NEW"
test -s "$NEW/index.html"
ln -sfn "$NEW" "$BASE/current.next"
mv -Tf "$BASE/current.next" "$BASE/current"
if ! nginx -t; then
  if [ -n "$PREVIOUS" ]; then ln -sfn "$PREVIOUS" "$BASE/current"; fi
  exit 1
fi
systemctl reload nginx
if ! curl -fsS --max-time 15 -H 'Host: blog.reaier.top' http://127.0.0.1/ >/dev/null; then
  if [ -n "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$BASE/current"
    nginx -t && systemctl reload nginx
  fi
  exit 1
fi
rm -f "$ARCHIVE"
CURRENT="$(basename "$(readlink -f "$BASE/current")")"
find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | awk 'NR>5' | while read -r old; do
  if [ "$old" != "$CURRENT" ]; then rm -rf -- "$BASE/releases/$old"; fi
done
echo "release=$RELEASE current=$CURRENT"
'@
$remoteScript = $remoteScript.Replace('__RELEASE__', $release).Replace('__ARCHIVE__', $remoteArchive)

if ($DryRun) {
  Write-Host '[4/5] Dry run: upload skipped.'
  Write-Host "Archive: $archive"
  Write-Host "Target: ${SshHost}:$remoteArchive"
  Write-Host '[5/5] Dry run complete.'
  exit 0
}

Write-Host '[4/5] Uploading release...'
Invoke-Checked 'scp.exe' @($archive, "${SshHost}:$remoteArchive")
Write-Host '[5/5] Switching release atomically...'
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
Invoke-Checked 'ssh.exe' @($SshHost, "echo $encoded | base64 -d | bash")
Write-Host "Deployment complete: $release"
