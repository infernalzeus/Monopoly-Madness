$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$toolsPath = if ($env:MONOPOLY_PLAYTEST_TOOLS) { $env:MONOPOLY_PLAYTEST_TOOLS } else { Join-Path $env:TEMP 'monopoly-playtest-tools' }
$javaPath = 'C:\Program Files\Android\Android Studio\jbr'
if (!(Test-Path -LiteralPath (Join-Path $javaPath 'bin\java.exe'))) { throw 'Set javaPath to an installed Java 21+ runtime.' }
$env:JAVA_HOME = $javaPath
$env:Path = "$javaPath\bin;$env:Path"
$env:JAVA_TOOL_OPTIONS = '-XX:ActiveProcessorCount=4'
$env:FIREBASE_CLI_DISABLE_USAGE_REPORTING = 'true'
$env:FIREBASE_EMULATORS_PATH = Join-Path $env:TEMP 'monopoly-playtest-emulators'
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'artifacts') | Out-Null
Copy-Item -LiteralPath 'firestore.rules' -Destination (Join-Path $PSScriptRoot 'artifacts\firestore.rules')
$firebasePath = Join-Path $toolsPath 'node_modules\.bin\firebase.cmd'
$jarPath = Join-Path $env:FIREBASE_EMULATORS_PATH 'cloud-firestore-emulator-v1.22.0.jar'
if (!(Test-Path -LiteralPath $jarPath)) { & $firebasePath setup:emulators:firestore }
if (!(Test-Path -LiteralPath $jarPath)) { throw 'Firestore emulator download did not complete.' }
$firestoreProcess = Start-Process -FilePath (Join-Path $javaPath 'bin\java.exe') -ArgumentList @(
  '-Xmx6g', '-XX:ActiveProcessorCount=4', '-jar', ('"{0}"' -f $jarPath),
  '--host', '127.0.0.1', '--port', '8180', '--project_id', 'demo-monopoly-playtest',
  '--single_project_mode', 'true', '--single_project_mode_error', 'true',
  '--rules', 'playtest/artifacts/firestore.rules'
) -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $PSScriptRoot 'artifacts\firestore-stdout.log') `
  -RedirectStandardError (Join-Path $PSScriptRoot 'artifacts\firestore-stderr.log')
$authExitCode = 0
try {
  & $firebasePath emulators:start --only auth --project demo-monopoly-playtest --config playtest/firebase.json --non-interactive
  $authExitCode = $LASTEXITCODE
} finally {
  if (!$firestoreProcess.HasExited) { Stop-Process -Id $firestoreProcess.Id }
}
exit $authExitCode
