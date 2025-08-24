param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

# Simple wrapper that runs the real uvx.exe and logs stdout/stderr to ~/.serena/uvx-wrapper-<timestamp>.log
$uvxPath = 'C:/Users/hr-hm/.local/bin/uvx.exe'
if (-not (Test-Path $uvxPath)) {
    Write-Error "uvx not found at $uvxPath"
    exit 2
}

$logDir = Join-Path $env:USERPROFILE '.serena'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDir "uvx-wrapper-$timestamp.log"

# Create a sentinel file immediately so transient spawns are detectable
$sentinelFile = Join-Path $logDir "uvx-wrapper-sentinel-$timestamp.txt"
"started: $(Get-Date -Format o)" | Out-File -FilePath $sentinelFile -Encoding utf8 -Append
"pid: $PID" | Out-File -FilePath $sentinelFile -Encoding utf8 -Append
"ppid: $(Get-CimInstance Win32_Process -Filter \"ProcessId=$PID\" | Select-Object -ExpandProperty ParentProcessId)" | Out-File -FilePath $sentinelFile -Encoding utf8 -Append
"args: $($Args -join ' ')" | Out-File -FilePath $sentinelFile -Encoding utf8 -Append

Write-Host "Running: $uvxPath $($Args -join ' ')" | Out-File -FilePath $logFile -Encoding utf8 -Append

# Execute and redirect output to the log file
try {
    & $uvxPath @Args *>> $logFile
    $exitCode = $LASTEXITCODE
} catch {
    "ERROR: $_" | Out-File -FilePath $logFile -Encoding utf8 -Append
    $exitCode = 1
}

Write-Host "uvx exited with code $exitCode. Log: $logFile"
exit $exitCode
