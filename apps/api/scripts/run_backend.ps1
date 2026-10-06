# run_backend.ps1 — Script para iniciar FastAPI (uvicorn) en el puerto 8000
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Split-Path -Parent $scriptDir
Set-Location $apiDir

$pythonExe = Join-Path $apiDir "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "Error: No se encontró el entorno virtual. Ejecuta primero .\scripts\setup_backend.ps1" -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando servidor FastAPI de O.IR en http://localhost:8000..." -ForegroundColor Cyan
& $pythonExe -m uvicorn main:app --reload --port 8000
