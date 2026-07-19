$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$WorkspaceRoot = Split-Path $Root -Parent
$DistRoot = Join-Path $WorkspaceRoot "dist"
$OutDir = Join-Path $DistRoot "learning-multiagent-win"
$ZipPath = Join-Path $DistRoot "learning-multiagent-win.zip"
$SfxScript = Join-Path $DistRoot "sfx-run.ps1"
$SedPath = Join-Path $DistRoot "learning-multiagent.sed"
$SfxExe = Join-Path $DistRoot "LearningMultiagentSetup.exe"
$AppName = "learning-multiagent"

function Copy-Directory($Source, $Destination) {
  if (!(Test-Path $Source)) {
    return
  }
  if (Test-Path $Destination) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $Destination) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

Write-Host "==> Building Next.js standalone app"
Push-Location $Root
try {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "next build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Write-Host "==> Preparing distribution folder"
if (Test-Path $OutDir) {
  Remove-Item -LiteralPath $OutDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Get-ChildItem -LiteralPath (Join-Path $Root ".next\standalone") -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $OutDir -Recurse -Force
}
Copy-Directory (Join-Path $Root ".next\static") (Join-Path $OutDir ".next\static")
Copy-Directory (Join-Path $Root "public") (Join-Path $OutDir "public")
Copy-Directory (Join-Path $Root "prisma") (Join-Path $OutDir "prisma")

$NodePath = (Get-Command node).Source
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $OutDir "node.exe") -Force

$FfmpegCandidate = $env:FFMPEG_PATH
if (!$FfmpegCandidate -or !(Test-Path $FfmpegCandidate)) {
  $FfmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($FfmpegCommand) {
    $FfmpegCandidate = $FfmpegCommand.Source
  }
}
if (!$FfmpegCandidate -or !(Test-Path $FfmpegCandidate)) {
  $FfmpegCandidate = Get-ChildItem -Path $env:LOCALAPPDATA -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if ($FfmpegCandidate -and (Test-Path $FfmpegCandidate)) {
  New-Item -ItemType Directory -Force -Path (Join-Path $OutDir "tools") | Out-Null
  Copy-Item -LiteralPath $FfmpegCandidate -Destination (Join-Path $OutDir "tools\ffmpeg.exe") -Force
  Write-Host "    Bundled ffmpeg: $FfmpegCandidate"
} else {
  Write-Host "    ffmpeg not found; packaged app will require FFMPEG_PATH or PATH on target machine."
}

if (Test-Path (Join-Path $Root ".env")) {
  Copy-Item -LiteralPath (Join-Path $Root ".env") -Destination (Join-Path $OutDir ".env") -Force
} elseif (Test-Path (Join-Path $Root ".env.example")) {
  Copy-Item -LiteralPath (Join-Path $Root ".env.example") -Destination (Join-Path $OutDir ".env") -Force
}

if (Test-Path (Join-Path $Root ".env.example")) {
  Copy-Item -LiteralPath (Join-Path $Root ".env.example") -Destination (Join-Path $OutDir ".env.example") -Force
}

@"
@echo off
cd /d "%~dp0"
set PORT=3000
set HOSTNAME=127.0.0.1
if not defined DATABASE_URL set DATABASE_URL=file:./prisma/dev.db
if exist "%~dp0tools\ffmpeg.exe" set FFMPEG_PATH=%~dp0tools\ffmpeg.exe
start "" http://127.0.0.1:%PORT%
node.exe server.js
pause
"@ | Set-Content -LiteralPath (Join-Path $OutDir "start.bat") -Encoding ASCII

Write-Host "==> Building Windows launcher exe when .NET SDK is available"
$DotnetSdks = & dotnet --list-sdks 2>$null
$HasDotnetSdk = $LASTEXITCODE -eq 0 -and $DotnetSdks.Count -gt 0

if ($HasDotnetSdk) {
  $LauncherWork = Join-Path $Root ".packager\win-launcher"
  if (Test-Path $LauncherWork) {
    Remove-Item -LiteralPath $LauncherWork -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $LauncherWork | Out-Null

  @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>StartLearningMultiagent</AssemblyName>
  </PropertyGroup>
</Project>
"@ | Set-Content -LiteralPath (Join-Path $LauncherWork "StartLearningMultiagent.csproj") -Encoding UTF8

  @"
using System.Diagnostics;
using System.Net.Http;

var appDir = AppContext.BaseDirectory;
var port = Environment.GetEnvironmentVariable("PORT");
if (string.IsNullOrWhiteSpace(port)) port = "3000";

Environment.SetEnvironmentVariable("PORT", port);
Environment.SetEnvironmentVariable("HOSTNAME", "127.0.0.1");
if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DATABASE_URL")))
{
    Environment.SetEnvironmentVariable("DATABASE_URL", "file:./prisma/dev.db");
}

var nodePath = Path.Combine(appDir, "node.exe");
if (!File.Exists(nodePath)) nodePath = "node";

var serverPath = Path.Combine(appDir, "server.js");
if (!File.Exists(serverPath))
{
    Console.WriteLine("server.js was not found. Please keep this exe in the packaged app folder.");
    Console.ReadKey();
    return 1;
}

Console.WriteLine("Starting Learning Multiagent...");
Console.WriteLine($"URL: http://127.0.0.1:{port}");

var process = new Process
{
    StartInfo = new ProcessStartInfo
    {
        FileName = nodePath,
        Arguments = "server.js",
        WorkingDirectory = appDir,
        UseShellExecute = false
    }
};

process.Start();

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
for (var i = 0; i < 30; i++)
{
    try
    {
        var response = await http.GetAsync($"http://127.0.0.1:{port}");
        if ((int)response.StatusCode < 500) break;
    }
    catch
    {
        await Task.Delay(1000);
    }
}

try
{
    Process.Start(new ProcessStartInfo
    {
        FileName = $"http://127.0.0.1:{port}",
        UseShellExecute = true
    });
}
catch
{
    Console.WriteLine("Please open the URL above in your browser.");
}

Console.WriteLine("Close this window to stop the app.");
process.WaitForExit();
return process.ExitCode;
"@ | Set-Content -LiteralPath (Join-Path $LauncherWork "Program.cs") -Encoding UTF8

  dotnet publish (Join-Path $LauncherWork "StartLearningMultiagent.csproj") `
    -c Release `
    -r win-x64 `
    --self-contained false `
    -p:PublishSingleFile=true `
    -p:PublishReadyToRun=false `
    -o $LauncherWork

  Copy-Item -LiteralPath (Join-Path $LauncherWork "StartLearningMultiagent.exe") -Destination (Join-Path $OutDir "StartLearningMultiagent.exe") -Force
} else {
  Write-Host "    .NET SDK not found; skipped exe launcher. Use start.bat in the package."
}

Write-Host "==> Creating self-extracting Windows exe when IExpress is available"
if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -LiteralPath $OutDir -DestinationPath $ZipPath -Force

@"
`$ErrorActionPreference = "Stop"
`$packageRoot = Join-Path `$env:LOCALAPPDATA "LearningMultiagent"
`$zip = Join-Path `$PSScriptRoot "learning-multiagent-win.zip"
if (Test-Path `$packageRoot) {
  Remove-Item -LiteralPath `$packageRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path `$packageRoot | Out-Null
Expand-Archive -LiteralPath `$zip -DestinationPath `$packageRoot -Force
`$appDir = Join-Path `$packageRoot "learning-multiagent-win"
Start-Process -FilePath (Join-Path `$appDir "start.bat") -WorkingDirectory `$appDir
"@ | Set-Content -LiteralPath $SfxScript -Encoding UTF8

$IExpressCommand = Get-Command iexpress.exe -ErrorAction SilentlyContinue
$IExpress = if ($IExpressCommand) { $IExpressCommand.Source } else { $null }
if ($IExpress) {
  if (Test-Path $SfxExe) {
    Remove-Item -LiteralPath $SfxExe -Force
  }

  $IExpressWork = Join-Path $env:TEMP "learning-multiagent-sfx"
  $IExpressExe = Join-Path $IExpressWork "LearningMultiagentSetup.exe"
  $IExpressSed = Join-Path $IExpressWork "learning-multiagent.sed"
  if (Test-Path $IExpressWork) {
    Remove-Item -LiteralPath $IExpressWork -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $IExpressWork | Out-Null
  Copy-Item -LiteralPath $ZipPath -Destination (Join-Path $IExpressWork "learning-multiagent-win.zip") -Force
  Copy-Item -LiteralPath $SfxScript -Destination (Join-Path $IExpressWork "sfx-run.ps1") -Force

  @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$IExpressExe
FriendlyName=Learning Multiagent
AppLaunched=powershell.exe -ExecutionPolicy Bypass -File sfx-run.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0=learning-multiagent-win.zip
FILE1=sfx-run.ps1
[SourceFiles]
SourceFiles0=$IExpressWork
[SourceFiles0]
%FILE0%=
%FILE1%=
"@ | Set-Content -LiteralPath $IExpressSed -Encoding ASCII

  & $IExpress /N /Q $IExpressSed
  if ($LASTEXITCODE -ne 0) {
    Write-Host "    IExpress failed with exit code $LASTEXITCODE. The zip package is still available."
  } else {
    for ($i = 0; $i -lt 240 -and !(Test-Path $IExpressExe); $i++) {
      Start-Sleep -Milliseconds 500
    }
    if (Test-Path $IExpressExe) {
      Copy-Item -LiteralPath $IExpressExe -Destination $SfxExe -Force
      Copy-Item -LiteralPath $IExpressSed -Destination $SedPath -Force
    } else {
      Write-Host "    IExpress completed but the expected exe was not found. The zip package is still available."
    }
  }
} else {
  Write-Host "    IExpress not found; skipped self-extracting exe."
}

@"
# Learning Multiagent Windows Package

Double-click StartLearningMultiagent.exe to start the app when it exists.
If the exe is not present, double-click start.bat.

Default URL:
http://127.0.0.1:3000

Notes:
- Keep .next, node_modules, prisma, public, server.js, and node.exe in this folder.
- The default SQLite database is prisma/dev.db.
- API keys and database settings are stored in .env.
- If port 3000 is already used, set PORT before launching the exe.

Fallback launcher:
start.bat
"@ | Set-Content -LiteralPath (Join-Path $OutDir "README.txt") -Encoding UTF8

Write-Host "==> Done"
Write-Host "Package: $OutDir"
Write-Host "Launcher: $(Join-Path $OutDir 'StartLearningMultiagent.exe')"
Write-Host "Fallback: $(Join-Path $OutDir 'start.bat')"
Write-Host "Zip: $ZipPath"
Write-Host "Self-extracting exe: $SfxExe"
