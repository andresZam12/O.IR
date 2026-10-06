# setup_backend.ps1 — Script de automatización de entorno virtual para O.IR API
$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Configurando entorno virtual para O.IR API  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Split-Path -Parent $scriptDir
Set-Location $apiDir

# 1. Crear entorno virtual si no existe
if (-not (Test-Path "venv")) {
    Write-Host "[1/4] Creando entorno virtual Python (venv)..." -ForegroundColor Yellow
    python -m venv venv
    Write-Host "      Entorno virtual creado exitosamente." -ForegroundColor Green
} else {
    Write-Host "[1/4] Entorno virtual 'venv' ya existe." -ForegroundColor Green
}

# 2. Activar entorno virtual
Write-Host "[2/4] Activando venv..." -ForegroundColor Yellow
$activateScript = Join-Path $apiDir "venv\Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    & $activateScript
}

# 3. Actualizar pip
Write-Host "[3/4] Actualizando pip..." -ForegroundColor Yellow
& "$apiDir\venv\Scripts\python.exe" -m pip install --upgrade pip

# 4. Instalar dependencias de requirements.txt
Write-Host "[4/4] Instalando paquetes desde requirements.txt..." -ForegroundColor Yellow
& "$apiDir\venv\Scripts\python.exe" -m pip install -r requirements.txt

Write-Host "=============================================" -ForegroundColor Green
Write-Host " ¡Entorno virtual de O.IR listo y configurado!" -ForegroundColor Green
Write-Host " Para iniciar el servidor corre: .\scripts\run_backend.ps1" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Green
