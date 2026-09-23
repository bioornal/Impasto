param([switch]$Test)
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.x C# compiler not found.' }
$bin = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$sources = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.cs' | Where-Object { $_.Name -notlike '*Tests.cs' } | ForEach-Object { $_.FullName })
if ($Test) {
    $sources += @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*Tests.cs' | ForEach-Object { $_.FullName })
    $output = Join-Path $bin 'PrinterAgent.Tests.exe'
    & $compiler /nologo /warnaserror+ /target:exe /main:PrinterAgent.Tests /reference:System.Web.Extensions.dll "/out:$output" $sources
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $output
    exit $LASTEXITCODE
}
$output = Join-Path $bin 'PrinterAgent.exe'
& $compiler /nologo /warnaserror+ /target:exe /main:PrinterAgent.Program /reference:System.Web.Extensions.dll "/out:$output" $sources
exit $LASTEXITCODE
