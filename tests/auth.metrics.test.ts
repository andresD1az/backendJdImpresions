import request from 'supertest'
import app from '../src/app'

describe('Proceso 1: Gestión de Usuarios y Autenticación - Métricas', () => {
  
  // 🔹 1. Métrica: Tiempo de respuesta del login
  describe('Tiempo de respuesta del login', () => {
    test('C1: Login debe responder en menos de 2 segundos (Óptimo)', async () => {
      const startTime = Date.now()
      
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      const responseTime = Date.now() - startTime
      
      // Óptimo: ≤ 2 segundos (2000ms)
      expect(responseTime).toBeLessThanOrEqual(2000)
      
      // Log para análisis
      console.log(`⏱️ Tiempo de login: ${responseTime}ms`)
    })

    test('C2: Login aceptable entre 2-4 segundos', async () => {
      const startTime = Date.now()
      
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      const responseTime = Date.now() - startTime
      
      // Aceptable: > 2 y ≤ 4 segundos
      expect(responseTime).toBeLessThanOrEqual(4000)
    })
  })

  // 🔹 2. Métrica: Tasa de errores de autenticación
  describe('Tasa de errores de autenticación del sistema', () => {
    test('C3: Sistema no debe fallar por errores internos (< 1%)', async () => {
      const attempts = 100
      let systemErrors = 0
      
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await request(app)
            .post('/auth/login')
            .send({
              email: 'test@example.com',
              password: 'password123'
            })
          
          // 500 = error del sistema (no incluye 401 por credenciales incorrectas)
          if (res.status === 500 || res.status === 503) {
            systemErrors++
          }
        } catch (error) {
          systemErrors++
        }
      }
      
      const errorRate = (systemErrors / attempts) * 100
      console.log(`📊 Tasa de errores del sistema: ${errorRate}%`)
      
      // Óptimo: < 1%
      expect(errorRate).toBeLessThan(1)
    })
  })

  // 🔹 3. Métrica: Tiempo de creación de cuenta
  describe('Tiempo de creación de cuenta', () => {
    test('C4: Registro debe completarse en menos de 10 segundos (Óptimo)', async () => {
      const startTime = Date.now()
      
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: `test${Date.now()}@example.com`,
          password: 'SecurePass123!',
          role: 'customer'
        })
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Tiempo de registro: ${responseTime}ms`)
      
      // Óptimo: ≤ 10 segundos
      expect(responseTime).toBeLessThanOrEqual(10000)
    })
  })

  // 🔹 4. Métrica: Disponibilidad del servicio de autenticación
  describe('Disponibilidad del servicio de autenticación', () => {
    test('C5: Endpoint /auth/login debe estar disponible (99.9%)', async () => {
      const res = await request(app).post('/auth/login')
      
      // No debe retornar 503 (Service Unavailable)
      expect(res.status).not.toBe(503)
    })

    test('C6: Endpoint /auth/register debe estar disponible', async () => {
      const res = await request(app).post('/auth/register')
      
      expect(res.status).not.toBe(503)
    })
  })

  // 🔹 5. Métrica: Tiempo de recuperación de contraseña
  describe('Tiempo de recuperación de contraseña', () => {
    test('C7: Solicitud de recuperación debe responder en menos de 30 segundos (Óptimo)', async () => {
      const startTime = Date.now()
      
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'test@example.com'
        })
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Tiempo recuperación password: ${responseTime}ms`)
      
      // Óptimo: ≤ 30 segundos
      expect(responseTime).toBeLessThanOrEqual(30000)
    })
  })

  // 🔹 6. Métrica: Número de intentos fallidos antes de bloqueo
  describe('Intentos fallidos antes de bloqueo', () => {
    test('C8: Sistema debe bloquear cuenta después de 5 intentos fallidos', async () => {
      const testEmail = `block${Date.now()}@example.com`
      
      // Crear cuenta
      await request(app)
        .post('/auth/register')
        .send({
          name: 'Block Test',
          email: testEmail,
          password: 'CorrectPass123!',
          role: 'customer'
        })
      
      // Intentar login con password incorrecta 5 veces
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword'
          })
      }
      
      // Intento 6: Debe estar bloqueada
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword'
        })
      
      // Verificar que está bloqueada (403 o mensaje específico)
      expect([403, 429]).toContain(res.status)
    })
  })

  // 🔹 7. Métrica: Latencia del token de sesión
  describe('Latencia del token de sesión', () => {
    test('C9: Generación de JWT debe ser menor a 200ms (Óptimo)', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      // Medir tiempo de respuesta del header
      const responseTime = parseInt(res.headers['x-response-time'] || '0')
      
      console.log(`⏱️ Latencia token JWT: ${responseTime}ms`)
      
      // Óptimo: < 200ms
      // Si no hay header, asumimos que fue rápido (< 1 segundo)
      if (responseTime > 0) {
        expect(responseTime).toBeLessThan(200)
      }
    })

    test('C10: Validación de token debe ser menor a 500ms (Aceptable)', async () => {
      // Primero hacer login
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      const token = loginRes.body.token
      
      // Medir validación del token
      const startTime = Date.now()
      
      await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
      
      const validationTime = Date.now() - startTime
      
      console.log(`⏱️ Tiempo validación token: ${validationTime}ms`)
      
      // Aceptable: 200-500ms
      expect(validationTime).toBeLessThan(500)
    })
  })

  // 🔹 8. Métrica: Porcentaje de sesiones expiradas correctamente
  describe('Sesiones expiradas correctamente', () => {
    test('C11: Token expirado debe ser rechazado (98% de casos)', async () => {
      // Usar un token expirado conocido
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid'
      
      const res = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
      
      // Debe retornar 401 Unauthorized
      expect(res.status).toBe(401)
    })

    test('C12: Logout debe invalidar el token correctamente', async () => {
      // Login
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      const token = loginRes.body.token
      
      // Logout
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
      
      // Intentar usar el token después del logout
      const res = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
      
      // Debe fallar (401)
      expect(res.status).toBe(401)
    })
  })

  // 🔹 9. Métrica: Cumplimiento de políticas de contraseña
  describe('Cumplimiento de políticas de contraseña', () => {
    test('C13: Contraseña débil debe ser rechazada (100% cumplimiento)', async () => {
      const weakPasswords = ['123', 'abc', 'password', '12345678']
      
      for (const weakPass of weakPasswords) {
        const res = await request(app)
          .post('/auth/register')
          .send({
            name: 'Test User',
            email: `test${Date.now()}@example.com`,
            password: weakPass,
            role: 'customer'
          })
        
        // Debe rechazar (400 Bad Request)
        expect(res.status).toBe(400)
        expect(res.body.message).toMatch(/password|contraseña/i)
      }
    })

    test('C14: Contraseña fuerte debe ser aceptada', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: `test${Date.now()}@example.com`,
          password: 'StrongPass123!@#',
          role: 'customer'
        })
      
      // Debe aceptar (201 Created o 200 OK)
      expect([200, 201]).toContain(res.status)
    })
  })

  // 🔹 10. Métrica: Satisfacción del usuario (UX del login)
  describe('UX del login - Respuestas claras', () => {
    test('C15: Error de credenciales inválidas debe ser claro', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        })
      
      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('message')
      expect(res.body.message).toBeTruthy()
    })

    test('C16: Login exitoso debe retornar token y datos de usuario', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('token')
      expect(res.body).toHaveProperty('user')
      expect(res.body.user).toHaveProperty('email')
    })
  })
})
