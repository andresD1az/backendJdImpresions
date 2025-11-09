import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
export const mpClient = accessToken ? new MercadoPagoConfig({ accessToken }) : null
export const mpPreference = mpClient ? new Preference(mpClient) : null
export const mpPayment = mpClient ? new Payment(mpClient) : null
