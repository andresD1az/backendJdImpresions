import request from 'supertest'
import app from '../src/app'

describe('Health endpoint', () => {
  // Nota: si ya tienes un caso en TestRail, renombra el test con su ID, por ejemplo:
  // test('C123: /health responde ok', async () => { ... })
  test('/health responde ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
  })
})
