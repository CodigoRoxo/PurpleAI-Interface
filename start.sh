#!/bin/bash
echo "==================================================="
echo "          Iniciando PurpleAI Interface             "
echo "==================================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não encontrado! Instale o Node.js 18+ em https://nodejs.org"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[1/3] Instalando dependências da raiz..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "[2/3] Instalando dependências do backend..."
    (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "[3/3] Instalando dependências do frontend..."
    (cd frontend && npm install)
fi

echo ""
echo "Iniciando Backend e Frontend em paralelo..."
echo "Acesse no navegador: http://localhost:3000"
echo "==================================================="
echo ""

npm run dev
