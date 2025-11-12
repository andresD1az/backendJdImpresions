# 🚀 Pipeline CI/CD Completo - JD Impresión Backend

## 📊 Diagrama del Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GITHUB PUSH / PR                                 │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 STAGE 1: LINT & CODE QUALITY                                        │
│  ├─ Checkout code                                                       │
│  ├─ Setup Node.js 18                                                    │
│  ├─ Install dependencies (npm ci)                                       │
│  ├─ Run ESLint (opcional)                                               │
│  └─ Check TypeScript types (npm run build)                              │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
                    ▼         ▼
┌──────────────────────────────┐  ┌─────────────────────────────────────┐
│  🧪 STAGE 2: TESTS           │  │  🔐 STAGE 2: SECURITY SCAN          │
│  ├─ Unit tests               │  │  ├─ npm audit                       │
│  ├─ Integration tests        │  │  ├─ Check vulnerabilities           │
│  ├─ Performance metrics      │  │  └─ Continue on non-critical        │
│  ├─ Generate reports          │  └─────────────────────────────────────┘
│  └─ Publish to TestRail      │                    │
└────────────┬─────────────────┘                    │
             │                                      │
             ▼                                      │
┌──────────────────────────────┐                    │
│  📊 STAGE 3: COVERAGE        │                    │
│  ├─ Run tests with coverage  │                    │
│  ├─ Generate lcov report     │                    │
│  └─ Upload artifacts         │                    │
└────────────┬─────────────────┘                    │
             │                                      │
             └──────────────┬───────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  🏗️ STAGE 4: BUILD & PACKAGE                                            │
│  ├─ Build TypeScript → JavaScript                                      │
│  ├─ Create deployment package                                           │
│  ├─ Install production dependencies only                                │
│  └─ Upload build artifact                                               │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
                    ▼         ▼
┌──────────────────────────────┐  ┌─────────────────────────────────────┐
│  🎭 STAGE 5: DEPLOY STAGING  │  │  🎯 STAGE 5: DEPLOY PRODUCTION      │
│  (develop branch / manual)   │  │  (main branch / manual + approval)  │
│  ├─ Download artifact        │  │  ├─ Download artifact               │
│  ├─ Deploy to Azure Staging  │  │  ├─ Deploy to Azure Production      │
│  └─ URL: *-staging.azure...  │  │  └─ URL: jdimpresion-api.azure...  │
└──────────────────────────────┘  └────────────┬────────────────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────────────────┐
                                  │  ✅ STAGE 6: POST-DEPLOY VERIFY      │
                                  │  ├─ Health check endpoint            │
                                  │  ├─ Smoke tests                      │
                                  │  └─ Notify success                   │
                                  └──────────────────────────────────────┘
```

## 📋 Workflows Disponibles

### 1. **test-api.yml** - Tests con TestRail (Activo)
**Trigger:** Push a `main`, Pull Requests
- ✅ Ejecuta tests unitarios
- ✅ Publica resultados a TestRail
- ✅ Genera reportes JSON

**Pasos:**
1. Setup Node.js
2. Install dependencies
3. Build
4. Run tests (Jest)
5. Publish to TestRail

### 2. **azure-deploy.yml** - Deployment Simple (Deshabilitado)
**Trigger:** Manual (`workflow_dispatch`)
- ⚠️ Deshabilitado hasta configurar publish profile
- Deploy directo a Azure App Service

### 3. **ci-cd-complete.yml** - Pipeline Completo (Nuevo) ⭐
**Trigger:** Push, PR, Manual

**Jobs en paralelo:**
- `lint` → Análisis de código
- `test` → Tests + TestRail (depende de lint)
- `security` → npm audit (depende de lint)
- `coverage` → Cobertura de código (depende de test)
- `build` → Compilar app (depende de test + security)
- `deploy-staging` → Deploy a staging (manual/develop)
- `deploy-production` → Deploy a prod (manual + approval)
- `verify-deployment` → Health checks

## 🎯 Flujo por Tipo de Evento

### Push a `main`
```
1. Lint ✅
2. Tests + Security (paralelo) ✅
3. Coverage ✅
4. Build ✅
5. ⏸️  Deployment pausado (requiere workflow_dispatch)
```

### Push a `develop`
```
1. Lint ✅
2. Tests + Security ✅
3. Coverage ✅
4. Build ✅
5. Deploy to Staging (automático) 🎭
```

### Pull Request
```
1. Lint ✅
2. Tests + Security ✅
3. Coverage ✅
4. Build ✅
5. ❌ No deployment
```

### Manual Dispatch (Production)
```
1. Lint ✅
2. Tests + Security ✅
3. Build ✅
4. Deploy to Production (con approval) 🎯
5. Verify deployment ✅
```

## 🔧 Variables de Entorno Necesarias

### Para Testing (GitHub Secrets)
```
TESTRAIL_HOST=https://jdimpresion.testrail.io
TESTRAIL_USERNAME=tu-email@example.com
TESTRAIL_API_KEY=tu-api-key
TESTRAIL_PROJECT_ID=2
TESTRAIL_SUITE_ID=0
```

### Para Deployment (GitHub Secrets)
```
AZURE_WEBAPP_PUBLISH_PROFILE=<contenido del .PublishSettings>
AZURE_WEBAPP_PUBLISH_PROFILE_STAGING=<contenido staging>
```

### Para Runtime (Azure App Settings)
```
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=product-images
JWT_SECRET=tu-secret-aqui
DATABASE_URL=postgresql://...
```

## 📊 Métricas Monitoreadas

### Tests (33 casos)
- **C1-C16:** Autenticación (tiempos, errores, seguridad)
- **C17-C33:** Ventas (registro, exactitud, integraciones)
- **Métricas:**
  - Tiempo de respuesta (óptimo/aceptable/deficiente)
  - Tasas de error (< 1%)
  - Disponibilidad (> 99.9%)

### Coverage
- Líneas cubiertas por tests
- Funciones testeadas
- Branches evaluados

### Security
- Vulnerabilidades conocidas (npm audit)
- Dependencias desactualizadas

## 🎨 Estados en GitHub

### ✅ Success (Verde)
- Todos los stages pasaron
- Tests exitosos
- Build correcto

### ⚠️ Warning (Amarillo)
- Tests pasaron pero con warnings
- Security scan encontró vulnerabilidades menores

### ❌ Failure (Rojo)
- Lint errors
- Tests fallidos
- Build errors

### ⏸️ Pending (Gris)
- Esperando approval para production
- Workflow pausado

## 🚦 Cómo Usar

### Ejecutar Tests Localmente
```bash
npm test                    # Todos los tests
npm test auth.metrics      # Solo autenticación
npm test sales.metrics     # Solo ventas
npm test -- --coverage     # Con coverage
```

### Ejecutar Pipeline Completo (Local)
```bash
npm run lint               # Linting
npm run build              # Build
npm test                   # Tests
npm run report:testrail    # Publicar a TestRail
```

### Disparar Deployment Manual
1. Ve a: https://github.com/andresD1az/backendJdImpresions/actions
2. Select "CI/CD Complete Pipeline"
3. Click "Run workflow"
4. Selecciona branch (main para prod, develop para staging)
5. Click "Run workflow"

### Ver Resultados
- **GitHub Actions:** https://github.com/andresD1az/backendJdImpresions/actions
- **TestRail:** https://jdimpresion.testrail.io/index.php?/projects/overview/2
- **Azure Portal:** https://portal.azure.com

## 📈 Próximas Mejoras

- [ ] Integrar SonarQube para análisis estático
- [ ] Agregar tests E2E con Playwright
- [ ] Implementar blue-green deployment
- [ ] Agregar notificaciones de Slack/Teams
- [ ] Implementar rollback automático
- [ ] Agregar performance benchmarks
- [ ] Integrar con Grafana para métricas

## 🆘 Troubleshooting

### Tests fallan por Azure Storage
**Fix:** Ya implementado - usa mock en entorno de testing

### Deployment falla
**Fix:** Verificar que `AZURE_WEBAPP_PUBLISH_PROFILE` esté configurado

### TestRail no recibe resultados
**Fix:** Verificar secrets de TestRail en GitHub

### Build muy lento
**Fix:** Usar cache de npm (ya configurado)

---

**Última actualización:** Noviembre 2025
**Mantenedor:** andresD1az
**Documentación relacionada:** TESTING_GUIDE.md, METRICS_TESTING_GUIDE.md
