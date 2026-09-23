param([string]$ConfigPath = (Join-Path $PSScriptRoot 'config.local.json'))
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$printer = Get-Printer | Where-Object { $_.Name -ceq $config.queueName }
if (-not $printer) { throw 'No existe la cola exacta configurada.' }
$executable = Join-Path $PSScriptRoot 'bin/PrinterAgent.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Primero ejecutar build.ps1.' }
& $executable --serve $ConfigPath
exit $LASTEXITCODE
