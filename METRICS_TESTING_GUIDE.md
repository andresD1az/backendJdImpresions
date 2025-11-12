# Guía de Testing de Métricas - Procesos de Negocio

## 📊 Resumen de Implementación

Se han implementado **33 tests** que miden métricas específicas de 3 procesos críticos del negocio:

- **Proceso 1:** Gestión de Usuarios y Autenticación (16 tests: C1-C16)
- **Proceso 3:** Gestión de Ventas (17 tests: C17-C33)
- **Proceso 2:** Gestión de Inventario (pendiente)

## 🎯 Métricas Implementadas

### Proceso 1: Autenticación (16 tests)

| ID | Métrica | Rango Óptimo | Casos de Test |
|----|---------|--------------|---------------|
| 1 | Tiempo de respuesta del login | ≤ 2s | C1, C2 |
| 2 | Tasa de errores de autenticación | < 1% | C3 |
| 3 | Tiempo de creación de cuenta | ≤ 10s | C4 |
| 4 | Disponibilidad del servicio | ≥ 99.9% | C5, C6 |
| 5 | Tiempo de recuperación de contraseña | ≤ 30s | C7 |
| 6 | Intentos fallidos antes de bloqueo | 3-5 intentos | C8 |
| 7 | Latencia del token de sesión | < 200ms | C9, C10 |
| 8 | Sesiones expiradas correctamente | ≥ 98% | C11, C12 |
| 9 | Cumplimiento de políticas de contraseña | 100% | C13, C14 |
| 10 | Satisfacción del usuario (UX) | > 4 | C15, C16 |

### Proceso 3: Ventas (17 tests)

| ID | Métrica | Rango Óptimo | Casos de Test |
|----|---------|--------------|---------------|
| 1 | Tiempo de registro de venta | ≤ 3s | C17, C18 |
| 2 | Exactitud del registro | ≥ 99% | C19, C20 |
| 3 | Disponibilidad del módulo | ≥ 99.9% | C21, C22 |
| 4 | Tiempo de generación de factura | ≤ 5s | C23 |
| 5 | Errores de integración con inventario | < 1% | C24, C25 |
| 6 | Cancelaciones erróneas | < 0.5% | C26 |
| 7 | Sincronización con clientes | ≤ 5s | C27 |
| 8 | Éxito de transacciones de pago | ≥ 99.5% | C28, C29 |
| 9 | Tiempo de respuesta general | ≤ 2s | C30, C31 |
| 10 | Satisfacción del usuario | > 4 | C32, C33 |

## 📁 Estructura de Archivos

```
tests/
├── auth.metrics.test.ts     # Proceso 1: Autenticación (C1-C16)
├── sales.metrics.test.ts    # Proceso 3: Ventas (C17-C33)
└── health.test.ts           # Test de ejemplo básico
```

## 🚀 Ejecutar los Tests

### Todos los tests
```bash
npm test
```

### Solo Autenticación
```bash
npm test auth.metrics
```

### Solo Ventas
```bash
npm test sales.metrics
```

### Con coverage
```bash
npm test -- --coverage
```

### Modo watch (desarrollo)
```bash
npm test -- --watch
```

## 📋 Crear Casos en TestRail

### Paso 1: Crear Secciones en TestRail

1. Ve a tu proyecto: https://jdimpresion.testrail.io/index.php?/projects/overview/2
2. Click en "Test Cases"
3. Crea las siguientes secciones:
   - **Proceso 1: Autenticación**
   - **Proceso 2: Inventario**
   - **Proceso 3: Ventas**

### Paso 2: Crear Casos (C1-C33)

Para cada test, crea un caso con:

**Ejemplo para C1:**
- **Title:** Tiempo de respuesta del login (Óptimo)
- **Section:** Proceso 1: Autenticación
- **Type:** Performance
- **Priority:** High
- **Automation:** Automated
- **Expected Result:** Login responde en menos de 2 segundos
- **Preconditions:** Usuario válido existente en BD

**Repite para todos los casos C1-C33**

### Paso 3: Obtener IDs

Al crear cada caso, TestRail asigna un ID (C1, C2, C3, etc.). 

**Los tests YA están vinculados** con estos IDs en el código:
```typescript
test('C1: Login debe responder en menos de 2 segundos (Óptimo)', ...)
test('C2: Login aceptable entre 2-4 segundos', ...)
// etc.
```

## 🔄 Workflow Automático

Cuando hagas push a GitHub:

1. **GitHub Actions ejecuta** el workflow `test-api.yml`
2. **Jest corre** todos los tests
3. **Script publica** resultados a TestRail
4. **Test Run creado** automáticamente en TestRail
5. **Resultados vinculados** a cada caso C1-C33

## 📊 Interpretar Resultados

### En Consola
```bash
⏱️ Tiempo de login: 345ms          ✅ ÓPTIMO (< 2s)
📊 Tasa de errores: 0.5%            ✅ ÓPTIMO (< 1%)
⏱️ Tiempo registro: 1250ms          ✅ ÓPTIMO (< 3s)
```

### En TestRail
- **Passed (Verde):** Métrica en rango óptimo
- **Failed (Rojo):** Métrica fuera de rango aceptable
- **Comentarios:** Valores reales medidos

## 🛠️ Adaptación a tu Backend

Los tests actuales asumen endpoints estándar. **Debes adaptar:**

### 1. Endpoints Reales
```typescript
// Cambiar esto:
.post('/auth/login')

// Por tu endpoint real:
.post('/api/v1/authentication/login')
```

### 2. Datos de Test
```typescript
// Cambiar credenciales de prueba:
email: 'test@example.com',
password: 'password123'

// Por usuarios reales de tu entorno de testing
```

### 3. Estructura de Respuestas
```typescript
// Adaptar según tu API:
expect(res.body.token)       // Si tu API retorna 'token'
expect(res.body.accessToken) // Si tu API retorna 'accessToken'
```

## ⚠️ Tests que Requieren Implementación

Algunos tests asumen funcionalidades que puede que no tengas implementadas:

- **C7:** Recuperación de contraseña (`/auth/forgot-password`)
- **C8:** Bloqueo por intentos fallidos
- **C11-C12:** Invalidación de tokens al logout
- **C13-C14:** Validación de políticas de contraseña
- **C23:** Generación de facturas (`/sales/{id}/invoice`)
- **C26:** Cancelación de ventas
- **C27:** Historial de clientes (`/customers/{id}/sales`)
- **C28:** Integración con pasarela de pagos

**Opciones:**
1. **Implementar las funcionalidades** faltantes
2. **Marcar tests como skip** temporalmente:
   ```typescript
   test.skip('C7: ...', async () => {
   ```
3. **Adaptar tests** a lo que SÍ tienes implementado

## 📈 Monitoreo Continuo

### Dashboard de Métricas (Recomendado)

Crea un dashboard en TestRail con:
- Tasa de tests pasados por proceso
- Tendencia de tiempos de respuesta
- Alertas cuando métricas salen de rango

### Grafana (Opcional)

Para métricas en tiempo real, integra con Grafana:
- Tiempos de respuesta promedio
- Tasa de errores por endpoint
- Throughput de operaciones

## 🎯 Próximos Pasos

1. **Crear casos C1-C33** en TestRail
2. **Adaptar endpoints** en los tests
3. **Ejecutar tests localmente:**
   ```bash
   npm test
   ```
4. **Revisar qué falla** y adaptar código
5. **Hacer push** para ejecutar en CI
6. **Ver resultados** en TestRail

## 💡 Tips

### Para Debug
```typescript
// Agregar logs detallados:
console.log('Response:', JSON.stringify(res.body, null, 2))
console.log('Status:', res.status)
```

### Para Tests Lentos
```typescript
// Aumentar timeout:
jest.setTimeout(30000) // 30 segundos
```

### Para Datos de Prueba
```bash
# Crear script de seed:
npm run db:seed-test
```

## 📞 Soporte

Si un test falla constantemente:
1. Verifica que el endpoint existe
2. Revisa los datos de prueba
3. Confirma permisos de autenticación
4. Adapta las expectativas (expect) a tu implementación

---

**Documentación completa:** Ver `TESTING_GUIDE.md` para más detalles sobre TestRail.
