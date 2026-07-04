Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $serviceRoot
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    throw "Workspace virtual environment not found at $python."
}

Push-Location $serviceRoot
try {
    if (-not (Test-Path (Join-Path $serviceRoot 'symptom_model.pkl')) -or -not (Test-Path (Join-Path $serviceRoot 'symptom_features.pkl'))) {
        & $python (Join-Path $serviceRoot 'train_model.py') --data-dir $serviceRoot
        if ($LASTEXITCODE -ne 0) {
            throw 'Model training failed.'
        }
    }

    & $python (Join-Path $serviceRoot 'app.py')
} finally {
    Pop-Location
}