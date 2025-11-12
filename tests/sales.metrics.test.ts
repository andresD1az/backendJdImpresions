import request from 'supertest'
import app from '../src/app'

describe('Proceso 3: Gestión de Ventas - Métricas', () => {
  
  let authToken: string
  
  // Setup: Login antes de los tests
  beforeAll(async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'manager@example.com',
        password: 'password123'
      })
    
    authToken = res.body.token
  })

  // 🔹 1. Métrica: Tiempo promedio de registro de venta
  describe('Tiempo promedio de registro de venta', () => {
    test('C17: Registro de venta debe completarse en menos de 3 segundos (Óptimo)', async () => {
      const startTime = Date.now()
      
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [
            { productId: 1, quantity: 2, price: 50.00 },
            { productId: 2, quantity: 1, price: 30.00 }
          ],
          paymentMethod: 'credit_card',
          total: 130.00
        })
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Tiempo registro de venta: ${responseTime}ms`)
      
      // Óptimo: ≤ 3 segundos
      expect(responseTime).toBeLessThanOrEqual(3000)
    })

    test('C18: Venta con múltiples productos debe registrarse en menos de 7 segundos (Aceptable)', async () => {
      const startTime = Date.now()
      
      const products = []
      for (let i = 1; i <= 10; i++) {
        products.push({ productId: i, quantity: 1, price: 10.00 })
      }
      
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products,
          paymentMethod: 'cash',
          total: 100.00
        })
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Venta múltiple: ${responseTime}ms`)
      
      // Aceptable: > 3 y ≤ 7 segundos
      expect(responseTime).toBeLessThanOrEqual(7000)
    })
  })

  // 🔹 2. Métrica: Exactitud del registro de ventas
  describe('Exactitud del registro de ventas', () => {
    test('C19: Venta registrada debe tener datos correctos (99% exactitud)', async () => {
      const saleData = {
        customerId: 1,
        products: [
          { productId: 1, quantity: 2, price: 25.50 },
          { productId: 2, quantity: 1, price: 49.00 }
        ],
        paymentMethod: 'credit_card',
        total: 100.00
      }
      
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saleData)
      
      expect(res.status).toBe(201)
      
      // Verificar datos guardados
      const saleId = res.body.id
      const getSale = await request(app)
        .get(`/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
      
      expect(getSale.body.customerId).toBe(saleData.customerId)
      expect(getSale.body.total).toBe(saleData.total)
      expect(getSale.body.products.length).toBe(saleData.products.length)
    })

    test('C20: Total de venta debe calcularse correctamente', async () => {
      const products = [
        { productId: 1, quantity: 3, price: 10.00 },  // 30
        { productId: 2, quantity: 2, price: 15.50 }   // 31
      ]
      const expectedTotal = 61.00
      
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products,
          paymentMethod: 'cash',
          total: expectedTotal
        })
      
      expect(res.body.total).toBe(expectedTotal)
    })
  })

  // 🔹 3. Métrica: Disponibilidad del módulo de ventas
  describe('Disponibilidad del módulo de ventas', () => {
    test('C21: Endpoint /sales debe estar disponible (99.9%)', async () => {
      const res = await request(app)
        .get('/sales')
        .set('Authorization', `Bearer ${authToken}`)
      
      expect(res.status).not.toBe(503)
    })

    test('C22: Creación de venta no debe retornar error 503', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 1, quantity: 1, price: 10 }],
          total: 10
        })
      
      expect(res.status).not.toBe(503)
    })
  })

  // 🔹 4. Métrica: Tiempo de generación de factura o comprobante
  describe('Tiempo de generación de factura', () => {
    test('C23: Generación de factura debe completarse en menos de 5 segundos (Óptimo)', async () => {
      // Crear venta
      const saleRes = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 1, quantity: 1, price: 50 }],
          paymentMethod: 'cash',
          total: 50
        })
      
      const saleId = saleRes.body.id
      
      // Generar factura
      const startTime = Date.now()
      
      const res = await request(app)
        .get(`/sales/${saleId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Generación de factura: ${responseTime}ms`)
      
      // Óptimo: ≤ 5 segundos
      expect(responseTime).toBeLessThanOrEqual(5000)
    })
  })

  // 🔹 5. Métrica: Tasa de errores en la integración con inventario
  describe('Integración con inventario', () => {
    test('C24: Venta debe actualizar stock correctamente (< 1% errores)', async () => {
      const productId = 1
      
      // Obtener stock inicial
      const initialStock = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
      
      const stockBefore = initialStock.body.stock
      
      // Realizar venta
      await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId, quantity: 2, price: 10 }],
          paymentMethod: 'cash',
          total: 20
        })
      
      // Verificar stock actualizado
      const finalStock = await request(app)
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
      
      const stockAfter = finalStock.body.stock
      
      // Stock debe reducirse en 2 unidades
      expect(stockAfter).toBe(stockBefore - 2)
    })

    test('C25: Venta sin stock disponible debe ser rechazada', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 999, quantity: 100, price: 10 }],
          paymentMethod: 'cash',
          total: 1000
        })
      
      // Debe retornar error (400 o 422)
      expect([400, 422]).toContain(res.status)
    })
  })

  // 🔹 6. Métrica: Tasa de cancelaciones o devoluciones erróneas
  describe('Cancelaciones y devoluciones', () => {
    test('C26: Cancelación de venta debe procesarse correctamente (< 0.5% errores)', async () => {
      // Crear venta
      const saleRes = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 1, quantity: 1, price: 50 }],
          total: 50
        })
      
      const saleId = saleRes.body.id
      
      // Cancelar venta
      const res = await request(app)
        .post(`/sales/${saleId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
      
      expect(res.status).toBe(200)
      
      // Verificar estado
      const getSale = await request(app)
        .get(`/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
      
      expect(getSale.body.status).toBe('cancelled')
    })
  })

  // 🔹 7. Métrica: Tiempo promedio de sincronización con el módulo de clientes
  describe('Sincronización con módulo de clientes', () => {
    test('C27: Historial de cliente debe actualizarse en menos de 5 segundos (Óptimo)', async () => {
      const customerId = 1
      
      // Crear venta
      const saleRes = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          products: [{ productId: 1, quantity: 1, price: 50 }],
          total: 50
        })
      
      const saleId = saleRes.body.id
      
      // Verificar en historial del cliente
      const startTime = Date.now()
      
      const res = await request(app)
        .get(`/customers/${customerId}/sales`)
        .set('Authorization', `Bearer ${authToken}`)
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Sincronización con clientes: ${responseTime}ms`)
      
      // Verificar que la venta está en el historial
      const salesIds = res.body.map((s: any) => s.id)
      expect(salesIds).toContain(saleId)
      
      // Óptimo: ≤ 5 segundos
      expect(responseTime).toBeLessThanOrEqual(5000)
    })
  })

  // 🔹 8. Métrica: Tasa de éxito de transacciones de pago
  describe('Transacciones de pago', () => {
    test('C28: Pago con tarjeta debe procesarse exitosamente (99.5% éxito)', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 1, quantity: 1, price: 100 }],
          paymentMethod: 'credit_card',
          cardDetails: {
            number: '4111111111111111',
            cvv: '123',
            expiry: '12/25'
          },
          total: 100
        })
      
      expect([200, 201]).toContain(res.status)
      expect(res.body.paymentStatus).toBe('approved')
    })

    test('C29: Pago en efectivo debe registrarse correctamente', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 1, quantity: 1, price: 50 }],
          paymentMethod: 'cash',
          total: 50
        })
      
      expect([200, 201]).toContain(res.status)
      expect(res.body.paymentStatus).toBe('paid')
    })
  })

  // 🔹 9. Métrica: Tiempo promedio de respuesta del sistema de ventas
  describe('Tiempo de respuesta del sistema de ventas', () => {
    test('C30: Consulta de productos debe responder en menos de 2 segundos (Óptimo)', async () => {
      const startTime = Date.now()
      
      const res = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${authToken}`)
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Consulta de productos: ${responseTime}ms`)
      
      // Óptimo: ≤ 2 segundos
      expect(responseTime).toBeLessThanOrEqual(2000)
    })

    test('C31: Aplicación de descuento debe procesarse rápidamente', async () => {
      const startTime = Date.now()
      
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 1, quantity: 2, price: 50 }],
          discount: 10, // 10% descuento
          paymentMethod: 'cash',
          total: 90
        })
      
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ Aplicación descuento: ${responseTime}ms`)
      
      // Aceptable: ≤ 5 segundos
      expect(responseTime).toBeLessThanOrEqual(5000)
      expect(res.body.discount).toBe(10)
    })
  })

  // 🔹 10. Métrica: Satisfacción del usuario
  describe('UX del sistema de ventas', () => {
    test('C32: Respuesta de venta exitosa debe incluir confirmación clara', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [{ productId: 1, quantity: 1, price: 50 }],
          paymentMethod: 'cash',
          total: 50
        })
      
      expect([200, 201]).toContain(res.status)
      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('total')
      expect(res.body).toHaveProperty('status')
      expect(res.body.message || res.body.status).toBeTruthy()
    })

    test('C33: Error en venta debe mostrar mensaje descriptivo', async () => {
      const res = await request(app)
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          products: [], // Sin productos
          total: 0
        })
      
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
      expect(res.body.message).toBeTruthy()
    })
  })
})
