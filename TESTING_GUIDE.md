# Guía de Testing con TestRail

## Configuración completada ✅

- Jest + Supertest para tests de API
- GitHub Actions workflow para CI
- Publicación automática de resultados a TestRail

## Cómo vincular tests con TestRail

### 1. Crear casos en TestRail

1. Ve a tu proyecto en TestRail: https://jdimpresion.testrail.io/index.php?/projects/overview/2
2. Click en "Test Cases"
3. Add Section (ej: "API", "Auth", "Uploads")
4. Add Case para cada funcionalidad
5. Copia el ID del caso (ej: `C123`)

### 2. Usar el ID en el test

En el título del test, incluye el ID del caso:

```typescript
// ❌ Sin ID - NO se publica a TestRail
test('/health responde ok', async () => {
  // ...
})

// ✅ Con ID - SÍ se publica a TestRail
test('C123: /health responde ok', async () => {
  // ...
})
```

### 3. Ejecutar tests localmente

```bash
# Ejecutar tests
npm test

# Ejecutar con coverage
npm test -- --coverage

# Ejecutar un solo archivo
npm test -- health.test.ts
```

### 4. Ver resultados en TestRail

Cuando haces push a GitHub:
1. GitHub Actions ejecuta el workflow `test-api.yml`
2. Corre los tests con Jest
3. El script `publish-testrail.js` crea un Test Run en TestRail
4. Publica los resultados de cada caso `C<ID>`
5. Cierra el Test Run

Ve los resultados en: TestRail → Test Runs & Results

## Estructura de archivos

```
tests/
  health.test.ts        # Test de ejemplo
  
scripts/
  publish-testrail.js   # Script para publicar a TestRail API v2

jest.config.ts          # Configuración de Jest

.github/workflows/
  test-api.yml          # CI workflow con TestRail
```

## Variables de entorno necesarias (GitHub Secrets)

Estos secrets ya están configurados en el repo:
- `TESTRAIL_HOST`
- `TESTRAIL_USERNAME`
- `TESTRAIL_API_KEY`
- `TESTRAIL_PROJECT_ID`
- `TESTRAIL_SUITE_ID`

## Agregar más tests

Crea nuevos archivos en `/tests`:

```typescript
// tests/auth.test.ts
import request from 'supertest'
import app from '../src/app'

describe('Auth endpoints', () => {
  test('C124: POST /auth/login con credenciales válidas retorna token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
    
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
  })

  test('C125: POST /auth/login con credenciales inválidas retorna 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrong' })
    
    expect(res.status).toBe(401)
  })
})
```

## Convenciones

- **IDs de caso**: Usa `C<número>` al inicio del título del test
- **Nombres descriptivos**: `C123: el usuario puede hacer login con credenciales válidas`
- **Un caso por test**: No mezcles múltiples verificaciones en un solo test
- **Organización**: Agrupa tests relacionados con `describe()`

## Troubleshooting

### El test pasa pero no aparece en TestRail
- Verifica que el título tenga el formato `C123: ...`
- Confirma que el caso C123 existe en TestRail
- Revisa los logs del workflow en GitHub Actions

### Error "Case not found"
- El ID del caso no existe en TestRail
- Crea el caso primero o usa un ID existente

### No se crea el Test Run
- Verifica que los secrets estén configurados en GitHub
- Revisa los logs del step "Publish to TestRail"

## Próximos pasos

1. Crea 3-5 casos base en TestRail
2. Copia los IDs (C123, C124, etc.)
3. Actualiza `tests/health.test.ts` con un ID real
4. Agrega más tests para tus endpoints
5. Haz push y verifica el Test Run en TestRail
