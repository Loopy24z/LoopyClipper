$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot 'work/startup'
$logPath = Join-Path $logDir 'startup.log'
$workerPath = Join-Path $projectRoot 'processor/worker.py'
$pythonPath = Join-Path $projectRoot 'work/processor-venv/Scripts/python.exe'

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -LiteralPath $logPath -Value "[$stamp] Starting LoofyAI startup checks."

# The website is hosted on Vercel; only its local processing worker needs to run here.
try {
    $workerPattern = [regex]::Escape($workerPath)
    $worker = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -match '^python(w)?\.exe$' -and $_.CommandLine -match $workerPattern
    } | Select-Object -First 1

    if ($worker) {
        Add-Content -LiteralPath $logPath -Value "[$stamp] Processor already running (PID $($worker.ProcessId))."
    } elseif (!(Test-Path -LiteralPath $pythonPath)) {
        Add-Content -LiteralPath $logPath -Value "[$stamp] Processor not started: Python environment is missing."
    } else {
        $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
        $ffprobe = Get-Command ffprobe -ErrorAction SilentlyContinue
        if (!$ffmpeg -or !$ffprobe) {
            Add-Content -LiteralPath $logPath -Value "[$stamp] Processor not started: FFmpeg/FFprobe is not on PATH."
        } else {
            $workerLog = Join-Path $logDir 'processor.log'
            $workerError = Join-Path $logDir 'processor-error.log'
            $started = Start-Process -FilePath $pythonPath `
                -ArgumentList @('-u', ('"' + $workerPath + '"')) `
                -WorkingDirectory $projectRoot `
                -WindowStyle Hidden `
                -RedirectStandardOutput $workerLog `
                -RedirectStandardError $workerError `
                -PassThru
            Add-Content -LiteralPath $logPath -Value "[$stamp] Processor started (PID $($started.Id))."
        }
    }
} catch {
    Add-Content -LiteralPath $logPath -Value "[$stamp] Startup check failed ($($_.Exception.GetType().Name))."
}

# Open the hosted app on login so it is ready to use alongside the local processor.
try {
    Start-Process 'https://loofyai.vercel.app'
    Add-Content -LiteralPath $logPath -Value "[$stamp] Opened the LoofyAI website."
} catch {
    Add-Content -LiteralPath $logPath -Value "[$stamp] Could not open the LoofyAI website."
}
