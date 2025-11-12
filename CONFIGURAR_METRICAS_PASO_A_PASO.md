# 🚀 Configurar Métricas en Producción - Paso a Paso

## ✅ PASO 1: Verificar que el Código Está Deployado (2 min)

### 1.1 Hacer Deploy a Azure

El código con métricas ya está pusheado. Ahora necesitas deployarlo:

```bash
# Opción A: GitHub Actions (Manual)
1. Ve a: https://github.com/andresD1az/backendJdImpresions/actions
2. Click "CI/CD Complete Pipeline"
3. Click "Run workflow"
4. Selecciona branch: main
5. Click "Run workflow"
6. Espera ~2 minutos

# Opción B: Azure CLI (si prefieres)
npm run build
az webapp deployment source config-zip ...
```

### 1.2 Verificar que Funciona

Abre en tu navegador:
```
https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2025-01-11T...",
  "environment": "production"
}
```

✅ Si ves esto, continuamos al siguiente paso.

---

## ✅ PASO 2: Verificar Endpoint de Métricas (1 min)

### 2.1 Probar el Endpoint /metrics

Abre en tu navegador:
```
https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net/metrics
```

Deberías ver:
```json
{
  "status": "ok",
  "metrics": {
    "totalRequests": 5,
    "errorRate": "0%",
    "averageResponseTime": "45ms",
    "topEndpoints": [
      { "path": "/health", "count": 3 },
      { "path": "/metrics", "count": 2 }
    ],
    "uptime": 120,
    "memoryUsage": { ... }
  },
  "timestamp": "2025-01-11T..."
}
```

✅ Si ves esto, ¡las métricas funcionan!

---

## ✅ PASO 3: Configurar Azure Metrics (5 min)

### 3.1 Ir al Azure Portal

```
1. Abre: https://portal.azure.com
2. Login con tu cuenta
3. Busca "App Services" en el buscador
4. Click en "jdimpresion-api"
```

### 3.2 Crear Dashboard de Métricas Básicas

```
En tu App Service:
1. Click "Metrics" (menú izquierdo)
2. Click "Add metric"
3. Selecciona:
   - Metric: "Http Requests"
   - Aggregation: "Sum"
4. Click "Add metric" otra vez
5. Selecciona:
   - Metric: "Response Time"
   - Aggregation: "Average"
6. Click "Add metric" otra vez
7. Selecciona:
   - Metric: "CPU Time"
   - Aggregation: "Average"
8. Click "Pin to dashboard" (arriba a la derecha)
```

✅ Ahora tienes un dashboard básico!

### 3.3 Ver tus Métricas

```
1. Ve al inicio de Azure Portal
2. Verás tu dashboard con las gráficas
```

---

## ✅ PASO 4: Activar Application Insights (10 min)

### 4.1 Habilitar Application Insights

```
En tu App Service (jdimpresion-api):
1. Scroll en menú izquierdo
2. Click "Application Insights"
3. Click "Turn on Application Insights"
4. Opciones:
   - Crear nuevo recurso: "jdimpresion-api-insights"
   - Location: Misma que tu app (Canada Central)
   - Log Analytics workspace: Crear nuevo
5. Click "Apply"
6. Click "Yes" en confirmación
7. Esperar 2-3 minutos
```

### 4.2 Agregar Variables de Entorno (Opcional pero Recomendado)

```
En tu App Service:
1. Click "Configuration" (menú izquierdo)
2. Click "Application settings"
3. Agregar:
   - APPLICATIONINSIGHTS_CONNECTION_STRING: (se auto-genera)
4. Click "Save"
5. Click "Continue"
```

### 4.3 Verificar que Funciona

```
1. Hacer algunas requests a tu API:
   - https://tu-app.azurewebsites.net/health
   - https://tu-app.azurewebsites.net/metrics
   - https://tu-app.azurewebsites.net/auth/login (POST)

2. Esperar 2-3 minutos

3. En Azure Portal:
   - Click "Application Insights" en tu App Service
   - Click "View Application Insights data"
   
4. Deberías ver:
   - Requests en tiempo real
   - Performance metrics
   - Dependency calls
```

✅ Application Insights está activo!

---

## ✅ PASO 5: Crear Dashboard Completo (10 min)

### 5.1 Ir a Application Insights

```
Azure Portal → Application Insights → jdimpresion-api-insights
```

### 5.2 Crear Dashboard con Métricas Clave

```
1. Click "Metrics" (menú izquierdo)

2. Agregar estas métricas (click "Add metric" cada vez):
   
   a) Requests per Second
      - Metric: Server requests
      - Aggregation: Count
   
   b) Response Time (Average)
      - Metric: Server response time
      - Aggregation: Average
   
   c) Failed Requests
      - Metric: Failed requests
      - Aggregation: Count
   
   d) Dependencies
      - Metric: Dependency calls
      - Aggregation: Count

3. Click "Pin to dashboard"
4. Nombre: "JD Impresión - Métricas"
5. Click "Pin"
```

### 5.3 Configurar Métricas en Vivo

```
1. En Application Insights
2. Click "Live Metrics" (menú izquierdo)
3. Deja esta pestaña abierta
4. Haz requests a tu API en otra ventana
5. Verás métricas actualizándose EN TIEMPO REAL
```

✅ Ahora ves todo en tiempo real!

---

## ✅ PASO 6: Configurar Alertas (10 min)

### 6.1 Crear Alerta de Response Time

```
1. Application Insights → Alerts
2. Click "Create" → "Alert rule"
3. Configurar:
   - Scope: Ya seleccionado (tu app)
   - Condition: Click "Add condition"
     - Signal: "Server response time"
     - Threshold: Static
     - Operator: Greater than
     - Threshold value: 1000 (ms)
     - Check frequency: Every 1 minute
   - Actions: Click "Create action group"
     - Nombre: "DevOps Team"
     - Email: tu-email@ejemplo.com
     - SMS: (opcional)
   - Alert rule name: "Slow Response Time Alert"
   - Severity: Warning (2)
4. Click "Create alert rule"
```

### 6.2 Crear Alerta de Error Rate

```
1. Application Insights → Alerts
2. Click "Create" → "Alert rule"
3. Configurar:
   - Condition: "Failed requests"
   - Operator: Greater than
   - Threshold: 10 (requests)
   - Aggregation period: 5 minutes
   - Alert rule name: "High Error Rate Alert"
   - Severity: Error (1)
4. Usar mismo action group
5. Click "Create alert rule"
```

### 6.3 Crear Alerta de Availability

```
1. Application Insights → Availability
2. Click "Add Standard test"
3. Configurar:
   - Test name: "Health Check"
   - URL: https://tu-app.azurewebsites.net/health
   - Test frequency: 5 minutes
   - Test locations: 3-5 locations
   - Success criteria: Status code = 200
   - Alerts enabled: Yes
4. Click "Create"
```

✅ Alertas configuradas! Recibirás emails si algo falla.

---

## ✅ PASO 7: Ver Logs en Tiempo Real (5 min)

### 7.1 Habilitar Logging

```
En tu App Service:
1. Click "App Service logs" (menú izquierdo)
2. Configurar:
   - Application logging: On
   - Level: Information
   - Web server logging: File System
   - Detailed error messages: On
   - Failed request tracing: On
3. Click "Save"
```

### 7.2 Ver Log Stream

```
1. En tu App Service
2. Click "Log stream" (menú izquierdo)
3. Verás logs en tiempo real:

2025-01-11 22:45:23 [INFO] {"eventType":"REQUEST_COMPLETED","metrics":{...}}
2025-01-11 22:45:24 [INFO] {"eventType":"BUSINESS_METRIC","metric":"LOGIN_TIME"...}
2025-01-11 22:45:25 [WARN] {"eventType":"PERFORMANCE_WARNING","duration":1200...}
```

✅ Logs en vivo funcionando!

---

## ✅ PASO 8: Crear Queries Personalizadas (5 min)

### 8.1 Query: Top Endpoints Más Usados

```
Application Insights → Logs

Query:
requests
| where timestamp > ago(24h)
| summarize Count = count() by url
| order by Count desc
| take 10
```

### 8.2 Query: Métricas de Negocio (Login Time)

```
traces
| where message contains "LOGIN_TIME"
| extend metric = parse_json(message)
| project timestamp, 
          duration = toreal(metric.metrics.value),
          passed = metric.metrics.passed
| summarize 
    AvgLoginTime = avg(duration),
    MaxLoginTime = max(duration),
    SuccessRate = countif(passed == true) * 100.0 / count()
```

### 8.3 Query: Requests Lentos

```
requests
| where timestamp > ago(1h)
| where duration > 1000
| project timestamp, name, duration, resultCode
| order by duration desc
```

### 8.4 Guardar Queries

```
1. Después de escribir cada query
2. Click "Save" (arriba)
3. Nombre: "Top Endpoints", "Login Metrics", etc.
4. Category: "Dashboards"
5. Click "Save"
```

✅ Queries guardadas para acceso rápido!

---

## ✅ PASO 9: Crear Dashboard Final (5 min)

### 9.1 Crear Nuevo Dashboard

```
Azure Portal (home):
1. Click "Dashboard" (menú superior)
2. Click "+ New dashboard"
3. Nombre: "JD Impresión - Production Metrics"
4. Click "Done customizing"
```

### 9.2 Agregar Widgets

```
1. Click "Edit" (arriba)
2. Arrastrar tiles desde la galería:
   
   a) Application Insights chart
      - Resource: jdimpresion-api-insights
      - Chart: Requests
   
   b) Application Insights chart
      - Resource: jdimpresion-api-insights
      - Chart: Response time
   
   c) Application Insights chart
      - Resource: jdimpresion-api-insights  
      - Chart: Failed requests
   
   d) Metrics chart
      - Resource: jdimpresion-api (App Service)
      - Metric: CPU Time
   
   e) Markdown tile
      - Contenido:
        # 📊 JD Impresión Metrics
        
        ## Quick Links
        - [Health Check](https://tu-app.../health)
        - [Metrics API](https://tu-app.../metrics)
        - [Live Metrics](link-a-app-insights)

3. Click "Done customizing"
4. Click "Share" → "Publish"
```

✅ Dashboard completo creado!

---

## ✅ PASO 10: Verificación Final (5 min)

### Checklist de Verificación

```
□ Endpoint /health responde
□ Endpoint /metrics muestra datos
□ Azure Metrics muestra gráficas
□ Application Insights está activo
□ Live Metrics muestra datos en tiempo real
□ Logs stream muestra logs
□ Alertas configuradas (3 mínimo)
□ Dashboard creado y visible
□ Queries guardadas
□ Action group para notificaciones
```

### Hacer Requests de Prueba

```bash
# Desde tu terminal o Postman:

# 1. Health check
curl https://tu-app.azurewebsites.net/health

# 2. Metrics
curl https://tu-app.azurewebsites.net/metrics

# 3. Login (genera métricas de negocio)
curl -X POST https://tu-app.azurewebsites.net/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 4. Products (genera métricas)
curl https://tu-app.azurewebsites.net/products

# Espera 2-3 minutos y verifica en:
# - Live Metrics (tiempo real)
# - Dashboard (gráficas)
# - Logs (stream)
```

---

## 📊 URLs Finales - Guárdalas!

```
# Tu Aplicación
Health: https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net/health
Metrics: https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net/metrics

# Azure Portal
Portal: https://portal.azure.com
App Service: Portal → App Services → jdimpresion-api
Application Insights: Portal → Application Insights → jdimpresion-api-insights

# Dashboards
Tu Dashboard: Portal → Dashboard → "JD Impresión - Production Metrics"
Live Metrics: Application Insights → Live Metrics

# GitHub
Actions: https://github.com/andresD1az/backendJdImpresions/actions
Repo: https://github.com/andresD1az/backendJdImpresions
```

---

## 🎯 Lo que Verás Después de Configurar Todo

### En Application Insights Live Metrics:
```
┌──────────────────────────────────────────┐
│  📊 Incoming Requests: 45/sec           │
│  ⏱️ Request Duration: 45ms (avg)        │
│  ❌ Failed Requests: 0                   │
│  💾 Memory: 85 MB                        │
│  🖥️ CPU: 15%                            │
│                                          │
│  Recent Requests:                        │
│  GET /health - 200 - 5ms                │
│  POST /auth/login - 200 - 16ms          │
│  GET /products - 200 - 7ms              │
│  POST /sales - 201 - 25ms               │
└──────────────────────────────────────────┘
```

### En tu Dashboard:
- **Gráfica de Requests**: Línea mostrando requests/hora
- **Gráfica de Response Time**: Promedio en últimas 24h
- **Gráfica de Errores**: Count de errores por hora
- **CPU/Memory**: Uso de recursos

### En Endpoint /metrics:
```json
{
  "totalRequests": 1234,
  "errorRate": "0.5%",
  "averageResponseTime": "45ms",
  "topEndpoints": [...]
}
```

---

## ⚡ Comandos Rápidos

```bash
# Ver métricas desde terminal
curl https://tu-app.azurewebsites.net/metrics | jq

# Watch métricas (actualiza cada 10s)
watch -n 10 'curl -s https://tu-app.azurewebsites.net/metrics | jq'

# Ver logs con Azure CLI
az webapp log tail --name jdimpresion-api --resource-group <tu-rg>

# Hacer deploy
cd c:/Users/eyner/CascadeProjects/backendJdImpresions
git push origin main
# Luego: GitHub Actions → Run workflow
```

---

## 🎊 ¡LISTO!

Después de seguir todos estos pasos tendrás:

✅ Métricas en tiempo real
✅ Dashboard visual completo
✅ Alertas automáticas
✅ Logs estructurados
✅ Queries personalizadas
✅ Monitoreo 24/7

**Tiempo total: ~1 hora**
**Resultado: Sistema de monitoreo profesional** 🚀
