$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot 'work/processor-venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Processor environment missing. Create work/processor-venv and install processor/requirements.txt first.' }
Get-Command ffmpeg -ErrorAction Stop | Out-Null
Get-Command ffprobe -ErrorAction Stop | Out-Null
Set-Location -LiteralPath $projectRoot
& $pythonPath -u (Join-Path $projectRoot 'processor/worker.py')
