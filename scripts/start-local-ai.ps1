$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$binary = Join-Path $projectRoot 'work/ollama/runtime/ollama.exe'
if (!(Test-Path -LiteralPath $binary)) { throw 'Ollama runtime missing. Install Ollama or restore the portable runtime in work/ollama/runtime.' }
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $projectRoot 'work/ollama/models'
$env:OLLAMA_NO_CLOUD = '1'
& $binary serve
