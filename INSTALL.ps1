# Script de Instalación Rápida - Backend JD Impressions
# Ejecutar como: .\INSTALL.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JD Impressions - Backend Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si existe .env
if (-Not (Test-Path ".env")) {
    Write-Host "⚠️  Archivo .env no encontrado" -ForegroundColor Yellow
    Write-Host "📝 Creando .env desde .env.example..." -ForegroundColor Yellow
    
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Archivo .env creado" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANTE: Edita el archivo .env y configura:" -ForegroundColor Yellow
        Write-Host "   - AZURE_STORAGE_CONNECTION_STRING" -ForegroundColor Yellow
        Write-Host "   - JWT_SECRET" -ForegroundColor Yellow
        Write-Host "   - DATABASE_URL" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "✅ Archivo .env encontrado" -ForegroundColor Green
}

# Instalar dependencias
Write-Host "📦 Instalando dependencias npm..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencias instaladas correctamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error al instalar dependencias" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Instalación Completada" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Verifica tu archivo .env" -ForegroundColor White
Write-Host "2. Ejecuta: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Documentación completa: README.md" -ForegroundColor Gray
Write-Host ""
