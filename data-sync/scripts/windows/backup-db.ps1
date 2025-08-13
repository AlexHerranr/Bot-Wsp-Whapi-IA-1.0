Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataSyncRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$envFile = Join-Path $dataSyncRoot '.env'
$backupsDir = Join-Path $dataSyncRoot 'backups'

if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Force -Path $backupsDir | Out-Null
}

# Load DATABASE_URL from data-sync/.env if not already set
if (-not $env:DATABASE_URL -and (Test-Path $envFile)) {
    Write-Host "Loading DATABASE_URL from $envFile"
    $envLines = Get-Content $envFile | Where-Object { $_ -match '=' -and -not $_.StartsWith('#') }
    foreach ($line in $envLines) {
        $kv = $line.Split('=', 2)
        if ($kv[0].Trim() -eq 'DATABASE_URL') {
            $env:DATABASE_URL = $kv[1].Trim()
        }
    }
}

if (-not $env:DATABASE_URL) {
    Write-Error "DATABASE_URL is not set. Set it in data-sync/.env or as an environment variable."
    exit 1
}

# Locate pg_dump
$candidates = @(
    'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe',
    'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe',
    'C:\Program Files\PostgreSQL\14\bin\pg_dump.exe',
    'pg_dump.exe'
)

$pgDump = $null
foreach ($c in $candidates) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { $pgDump = (Get-Command $c).Source; break }
}

if (-not $pgDump) {
    Write-Error "pg_dump not found. Install PostgreSQL client tools or adjust the path in this script."
    exit 1
}

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $backupsDir ("backup-$ts.dump")

Write-Host "Creating backup to $outFile"

& $pgDump --dbname=$env:DATABASE_URL --format=custom --file=$outFile --no-owner --no-privileges --compress=9

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Backup completed: $outFile"

