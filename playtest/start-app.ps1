$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'env') | Out-Null
@'
VITE_USE_EMULATOR=true
VITE_FIREBASE_API_KEY=fake-emulator-key
VITE_FIREBASE_AUTH_DOMAIN=demo-monopoly-playtest.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-monopoly-playtest
VITE_FIREBASE_APP_ID=1:123456789:web:playtest
'@ | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'env\.env.emulator')
& '.\node_modules\.bin\vite.cmd' --config playtest/vite.config.mjs --mode emulator
exit $LASTEXITCODE
