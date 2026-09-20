@echo off
title PurpleAI Interface
echo ===================================================
echo           Iniciando PurpleAI Interface
echo ===================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado! Instale o Node.js 18+ em https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [1/3] Instalando dependencias da raiz...
    call npm install
)

if not exist "backend\node_modules\" (
    echo [2/3] Instalando dependencias do backend...
    cd backend && call npm install && cd ..
)

if not exist "frontend\node_modules\" (
    echo [3/3] Instalando dependencias do frontend...
    cd frontend && call npm install && cd ..
)

echo.
echo Iniciando Backend e Frontend em paralelo...
echo Acesse no navegador: http://localhost:3000
echo ===================================================
echo.

call npm run dev
pause
