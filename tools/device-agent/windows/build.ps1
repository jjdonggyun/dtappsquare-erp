[CmdletBinding()]
param(
    [string]$CertificatePath,
    [string]$OutputPath
)
$ErrorActionPreference = 'Stop'
if (-not $CertificatePath) { $CertificatePath = Join-Path $PSScriptRoot 'company-root-ca.cer' }
if (-not $OutputPath) { $OutputPath = Join-Path $PSScriptRoot '..\..\..\public\downloads\DigitalSquare.DeviceAgent.Setup.exe' }
$certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2((Resolve-Path -LiteralPath $CertificatePath).Path)
if ($certificate.HasPrivateKey) { throw 'Use a public CA certificate without its private key.' }
if ($certificate.NotAfter.ToUniversalTime() -le [DateTime]::UtcNow) { throw 'The company CA certificate has expired.' }
$outputFile = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path $outputFile -Parent
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$framework = Split-Path $compiler -Parent
$references = @('System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Net.Http.dll','System.Security.dll','System.Web.Extensions.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 /warn:4 ("/out:" + $outputFile) ("/win32manifest:" + (Join-Path $PSScriptRoot 'app.manifest')) ("/resource:" + (Resolve-Path -LiteralPath $CertificatePath).Path + ',CompanyRoot.cer') $references (Join-Path $PSScriptRoot 'DeviceAgent.cs')
if ($LASTEXITCODE -ne 0) { throw 'Device Agent EXE build failed.' }
$hash = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $outputDirectory 'DigitalSquare.DeviceAgent.Setup.sha256'), $hash + '  ' + [IO.Path]::GetFileName($outputFile) + "`n", (New-Object Text.UTF8Encoding($false)))
Write-Output ('Built: ' + $outputFile)
Write-Output ('SHA-256: ' + $hash)
