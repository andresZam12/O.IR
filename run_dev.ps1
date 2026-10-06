# run_dev.ps1 — Inicia el Backend FastAPI y el Frontend Next.js en terminales separadas

$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = Get-Location
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "     Iniciando O.IR (Backend + Frontend)     " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Iniciar Backend FastAPI en ventana separada
$backendCmd = "Set-Location '$rootDir\apps\api'; if (Test-Path '.\venv\Scripts\Activate.ps1') { .\venv\Scripts\Activate.ps1 }; python -m uvicorn main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Write-Host "[OK] Backend lanzado en http://localhost:8000" -ForegroundColor Green

# 2. Iniciar Frontend Next.js en ventana separada
$frontendCmd = "Set-Location '$rootDir\apps\web'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Write-Host "[OK] Frontend lanzado en http://localhost:3000" -ForegroundColor Green

Write-Host ""
Write-Host "Ambos servicios se estan ejecutando en terminales independientes." -ForegroundColor Yellow
Write-Host "Abre tu navegador en: http://localhost:3000" -ForegroundColor Cyan
