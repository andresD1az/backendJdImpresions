# 📊 Dónde Ver las Métricas en Producción

## 🎯 Resumen Rápido

| Tipo de Métrica | Dónde Verla | Estado |
|-----------------|-------------|--------|
| **Tests CI/CD** | GitHub Actions | ✅ Activo |
| **Métricas de App** | Endpoint `/metrics` | ✅ Nuevo |
| **Azure Básico** | Azure Portal → Metrics | ✅ Disponible |
| **Azure Avanzado** | Application Insights | ⚠️ Configurar |
| **Logs en Tiempo Real** | Azure Log Stream | ✅ Disponible |

---

## 1. 📊 Métricas Durante Tests (CI/CD)

### Ubicación: GitHub Actions
```
https://github.com/andresD1az/backendJdImpresions/actions
```

### Qué Ves:
- ✅ Duración de cada test
- ✅ Tests pasando/fallando  
- ✅ Tiempos de respuesta medidos
- ✅ Tasa de errores
- ✅ Métricas de negocio (33 casos)

### Ejemplo de Output:
```
Run tests (Jest)
⏱️ Tiempo de login: 16ms
⏱️ Tiempo de registro: 6ms
⏱️ Recuperación password: 6ms
⏱️ Latencia token JWT: 0ms
⏱️ Validación token: 6ms
⏱️ Registro de venta: 25ms
⏱️ Venta múltiple: 23ms
📊 Tasa de errores: 0%

✅ Tests: 34 passed
⏱️ Duration: 25s
```

### Cómo Acceder:
1. Ve a GitHub Actions
2. Click en cualquier workflow run
3. Click en "Run tests (Jest)"
4. Scroll para ver los logs con métricas

---

## 2. 📊 Métricas de la Aplicación (NUEVO)

### Endpoint: `/metrics`

**URL en Producción:**
```
https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net/metrics
```

**URL Local:**
```
http://localhost:3000/metrics
```

### Qué Muestra:
```json
{
  "status": "ok",
  "metrics": {
    "totalRequests": 1234,
    "errorRate": "0.5%",
    "averageResponseTime": "45ms",
    "topEndpoints": [
      { "path": "/auth/login", "count": 345 },
      { "path": "/products", "count": 289 },
      { "path": "/sales", "count": 234 }
    ],
    "uptime": 86400,
    "memoryUsage": {
      "rss": 52428800,
      "heapTotal": 41943040,
      "heapUsed": 28672000
    }
  },
  "timestamp": "2025-01-11T22:45:00.000Z"
}
```

### Cómo Usarlo:
```bash
# Ver métricas actuales
curl https://tu-app.azurewebsites.net/metrics

# En un dashboard (cada 30 segundos)
watch -n 30 curl https://tu-app.azurewebsites.net/metrics
```

---

## 3. 📊 Azure Metrics (Básico)

### Ubicación: Azure Portal
```
https://portal.azure.com
→ App Services
→ jdimpresion-api
→ Metrics
```

### Métricas Disponibles:
- **CPU Time**: Uso de CPU
- **Memory Working Set**: Uso de memoria
- **Data In/Out**: Tráfico de red
- **Http Requests**: Cantidad de requests
- **Response Time**: Tiempo promedio de respuesta
- **Http 2xx/4xx/5xx**: Códigos de respuesta

### Cómo Crear Dashboard:
1. Ve a Azure Portal → tu App Service
2. Click "Metrics" (menú izquierdo)
3. Add metric → Selecciona "Http Requests"
4. Add metric → Selecciona "Response Time"  
5. Add metric → Selecciona "CPU Time"
6. Click "Pin to dashboard"

### Alertas Automáticas:
```
Portal → Alerts → New alert rule

Ejemplos:
- Response time > 1000ms → Email
- Error rate > 5% → Email + SMS
- CPU > 80% → Email
```

---

## 4. 📊 Azure Application Insights (Avanzado)

### ⚠️ REQUIERE CONFIGURACIÓN

### Cómo Activar:
1. Azure Portal → tu App Service
2. Click "Application Insights"
3. Click "Turn on Application Insights"
4. Create new o selecciona existente
5. Click "Apply"
6. Esperar 5 minutos para datos

### Métricas que Obtienes:
```
📊 Performance:
- Request rate (requests/sec)
- Response time (avg, p50, p95, p99)
- Failed requests (%)
- Server response time
- Dependency calls

📊 Usage:
- Users activos
- Sessions
- Page views
- Custom events

📊 Availability:
- Uptime %
- Geographic distribution
- Response from different locations

📊 Errors:
- Exception tracking
- Failed dependencies
- Error traces completos

📊 Custom:
- Business metrics que defines
- Eventos personalizados
- Telemetría custom
```

### Dashboard Application Insights:
```
Portal → Application Insights → tu recurso

Pestañas principales:
- Overview: Resumen general
- Live Metrics: Tiempo real
- Performance: Análisis de rendimiento
- Failures: Errores y excepciones
- Metrics: Métricas personalizadas
- Logs: Query logs con KQL
```

### Query de Ejemplo (KQL):
```kql
requests
| where timestamp > ago(1h)
| summarize 
    Count = count(),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95)
  by operation_Name
| order by Count desc
```

---

## 5. 📊 Logs en Tiempo Real

### Opción A: Azure Portal Log Stream

```
Portal → App Service → Log stream
```

Ves logs en tiempo real:
```
2025-01-11 22:45:23 [INFO] POST /auth/login - 200 - 16ms
2025-01-11 22:45:24 [INFO] GET /products - 200 - 7ms
2025-01-11 22:45:25 [INFO] POST /sales - 201 - 25ms
2025-01-11 22:45:26 [WARN] Slow request: POST /sales - 1200ms
2025-01-11 22:45:27 [ERROR] POST /sales - 500 - Error...
```

### Opción B: Azure CLI

```bash
# Instalar Azure CLI
# Windows: https://aka.ms/installazurecliwindows

# Login
az login

# Ver logs en tiempo real
az webapp log tail \
  --name jdimpresion-api \
  --resource-group tu-resource-group
```

### Opción C: Application Insights Logs

```
Portal → Application Insights → Logs

Query:
traces
| where timestamp > ago(1h)
| project timestamp, message, severityLevel
| order by timestamp desc
```

---

## 6. 📊 Métricas de Negocio Específicas

### En Tests (Automático):
```javascript
// Ya implementado en tests/auth.metrics.test.ts
C1: Tiempo de login < 50ms
C4: Tiempo de registro < 100ms
C7: Recuperación password < 500ms
C17: Registro de venta < 200ms
C30: Consulta productos < 50ms
... (33 métricas total)
```

### En Producción (Con el nuevo middleware):
```javascript
// Logs estructurados en Azure
{
  "eventType": "BUSINESS_METRIC",
  "metric": "LOGIN_TIME",
  "value": 16,
  "threshold": 100,
  "passed": true
}

{
  "eventType": "BUSINESS_METRIC",
  "metric": "SALES_OPERATION_TIME",
  "value": 25,
  "threshold": 500,
  "passed": true
}
```

### Query en Application Insights:
```kql
traces
| where customDimensions.eventType == "BUSINESS_METRIC"
| summarize 
    AvgValue = avg(toreal(customDimensions.value)),
    PassRate = countif(customDimensions.passed == "true") * 100.0 / count()
  by tostring(customDimensions.metric)
```

---

## 7. 📊 Dashboard Completo Recomendado

### Setup Sugerido:

**1. GitHub Actions** (Tests)
- Ver resultados de tests automáticos
- Métricas de CI/CD
- Duración del pipeline

**2. Endpoint `/metrics`** (Básico)
- Monitoreo simple sin configuración
- Métricas en tiempo real
- Fácil de integrar con otras herramientas

**3. Azure Metrics** (Infraestructura)
- CPU, Memory, Network
- Alertas automáticas
- Dashboard personalizado

**4. Application Insights** (Completo)
- Performance detallado
- Error tracking
- User analytics
- Custom metrics

---

## 8. 🚀 Cómo Monitorear en Producción

### Setup Mínimo (5 minutos):
```bash
1. Deploy app a Azure ✅
2. Abrir https://tu-app.azurewebsites.net/metrics
3. Ver Azure Portal → Metrics
4. Configurar 2-3 alertas básicas
```

### Setup Completo (30 minutos):
```bash
1. Activar Application Insights
2. Configurar custom metrics
3. Crear dashboard en Azure
4. Setup alertas avanzadas
5. Integrar con Slack/Email
```

---

## 9. 📊 Ejemplo de Dashboard de Métricas

### Lo que verías en Application Insights:

```
┌─────────────────────────────────────┐
│  📊 JD Impresión - Métricas Live    │
├─────────────────────────────────────┤
│                                     │
│  Requests: 1,234/hour  ↑ 15%       │
│  Avg Response: 45ms    ↓ 10%       │
│  Error Rate: 0.5%      → stable    │
│  Users: 89 active                   │
│                                     │
│  ⏱️ Top Slow Endpoints:            │
│  1. POST /sales - 125ms            │
│  2. GET /products - 45ms           │
│  3. POST /auth/login - 16ms        │
│                                     │
│  📈 Business Metrics:               │
│  - Login success: 99.5%            │
│  - Sales completed: 234            │
│  - Avg sale time: 25ms             │
│  - Inventory synced: 100%          │
│                                     │
│  ❌ Recent Errors: 0               │
│                                     │
└─────────────────────────────────────┘
```

---

## 10. ✅ Checklist de Setup

- [ ] Deploy a Azure
- [ ] Verificar endpoint `/health` funciona
- [ ] Verificar endpoint `/metrics` funciona
- [ ] Configurar Azure Metrics básicas
- [ ] Crear 2-3 alertas (response time, errors)
- [ ] Activar Application Insights (opcional)
- [ ] Crear dashboard en Azure Portal
- [ ] Configurar Log streaming
- [ ] Setup notificaciones (email/slack)
- [ ] Documentar URLs de métricas

---

## 🎯 URLs Importantes

### Producción:
```
App: https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net
Health: /health
Metrics: /metrics
```

### Dashboards:
```
GitHub Actions: https://github.com/andresD1az/backendJdImpresions/actions
Azure Portal: https://portal.azure.com → jdimpresion-api
```

---

**Con esto tienes visibilidad completa de tu aplicación en producción!** 🎉
