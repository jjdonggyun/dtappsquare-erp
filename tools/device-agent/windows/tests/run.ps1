$ErrorActionPreference = 'Stop'
$repoDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..\..')).Path
$sourceDir = Split-Path $PSScriptRoot -Parent
$testOutput = Join-Path $repoDir 'output\device-agent-tests'
$opensslCommand = Get-Command openssl.exe -ErrorAction SilentlyContinue
$openssl = if ($opensslCommand) { $opensslCommand.Source } else { Join-Path $env:ProgramFiles 'Git\usr\bin\openssl.exe' }
if (-not (Test-Path -LiteralPath $openssl -PathType Leaf)) { throw 'OpenSSL is required. Git for Windows includes usr\bin\openssl.exe.' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Split-Path $compiler -Parent
$references = @('System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Net.Http.dll','System.Security.dll','System.Web.Extensions.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
Push-Location $repoDir
try {
    & node (Join-Path $PSScriptRoot 'create-fixtures.mjs') $openssl
    if ($LASTEXITCODE -ne 0) { throw 'Test certificate generation failed.' }
    $testExe = Join-Path $testOutput 'AgentFixtureTests.exe'
    $cert = Join-Path $testOutput 'fixture\company-root-ca.cer'
    & $compiler /nologo /target:exe /define:TEST /optimize+ /codepage:65001 /main:TestHarness ("/out:" + $testExe) ("/resource:" + $cert + ',CompanyRoot.cer') $references (Join-Path $sourceDir 'DeviceAgent.cs') (Join-Path $PSScriptRoot 'TestHarness.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Native test build failed.' }
    & $testExe --ui-check
    if ($LASTEXITCODE -ne 0) { throw 'GUI validation failed.' }
    & $testExe --storage-check
    if ($LASTEXITCODE -ne 0) { throw 'Credential storage validation failed.' }
    & node (Join-Path $PSScriptRoot 'verify-native.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Native Agent protocol validation failed.' }
} finally { Pop-Location }
