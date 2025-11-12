# ⚠️ Adaptación de Tests Necesaria

## 🔍 Problema Identificado

Tu backend actualmente **solo tiene 2 endpoints**:
```
GET  /health              ✅ Funciona
POST /manager/uploads     ✅ Funciona (con auth)
```

Los tests esperan **27 endpoints adicionales** que NO existen:
```
❌ POST /auth/login
❌ POST /auth/register
❌ POST /auth/forgot-password
❌ POST /auth/logout
❌ GET  /auth/profile
❌ POST /sales
❌ GET  /sales/:id
❌ POST /sales/:id/cancel
❌ GET  /sales/:id/invoice
❌ GET  /products
❌ GET  /products/:id
❌ GET  /customers/:id/sales
... etc (27 endpoints faltantes)
```

## 📋 Resultado Actual

```
Tests: 18 fallaron ❌, 16 pasaron ✅

Fallaron porque retornan:
- Expected: 200/201/401  →  Received: 404 Not Found
```

## ✅ Opciones de Solución

### Opción 1: Deshabilitar Tests (Rápido - 5 min)
Marcar tests como `.skip` para las funcionalidades no implementadas.

**Ventajas:**
- ✅ CI pasa inmediatamente
- ✅ Puedes habilitar tests cuando implementes features
- ✅ Mantiene la estructura para el futuro

**Cómo:**
```typescript
// En auth.metrics.test.ts y sales.metrics.test.ts
describe.skip('Tests que requieren endpoints no implementados', () => {
  // ...tests aquí...
})
```

### Opción 2: Implementar Endpoints Básicos (Medio - 1-2 horas)
Crear endpoints mínimos para que los tests pasen.

**Implementar:**
```typescript
// src/modules/auth/router.ts
POST /auth/login        → Retornar mock token
POST /auth/register     → Retornar usuario creado
GET  /auth/profile      → Retornar usuario mock

// src/modules/sales/router.ts
POST /sales            → Retornar venta creada
GET  /sales/:id        → Retornar venta mock

// src/modules/products/router.ts
GET  /products         → Retornar array de productos
GET  /products/:id     → Retornar producto específico
```

### Opción 3: Tests Enfocados en lo que SÍ Tienes (Rápido - 15 min)
Crear tests nuevos para los 2 endpoints que funcionan.

**Crear:**
```typescript
// tests/uploads.metrics.test.ts
- C100: Subida de imagen debe completarse en < 5 segundos
- C101: Solo imágenes deben ser aceptadas
- C102: Límite de tamaño 10MB debe aplicarse
- C103: Autenticación requerida para uploads
- C104: Solo managers pueden subir imágenes
```

## 🚀 Recomendación Inmediata

**Opción 1 + Opción 3** (Mejor de ambos mundos):

1. **Deshabilitar tests que no aplican** (5 min)
2. **Crear tests para `/manager/uploads`** (15 min)
3. **CI pasa ✅**
4. **Implementar features gradualmente** (cuando quieras)

## 📝 Archivos a Modificar

Si eliges Opción 1:
```
tests/auth.metrics.test.ts    → Agregar .skip a describe()
tests/sales.metrics.test.ts   → Agregar .skip a describe()
```

Si eliges Opción 2:
```
src/modules/auth/router.ts      → Crear nuevo
src/modules/auth/controller.ts  → Crear nuevo
src/modules/sales/router.ts     → Crear nuevo
src/modules/sales/controller.ts → Crear nuevo
src/app.ts                      → Registrar routers
```

Si eliges Opción 3:
```
tests/uploads.metrics.test.ts   → Crear nuevo
```

## 🎯 Siguiente Paso

Dime qué opción prefieres y te lo implemento inmediatamente:
- **A)** Deshabilitar tests que no aplican
- **B)** Implementar endpoints básicos
- **C)** Crear tests para uploads
- **D)** Combinación (A + C recomendado)

---

**Estado actual del CI:**
- ✅ Infraestructura funciona
- ✅ Tests ejecutan sin errores técnicos
- ⚠️ 18 tests fallan por endpoints faltantes (esperado)
- ✅ Pipeline visible con todos los stages
