import React from 'react'

export default function Caja() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Panel Cajero</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded shadow p-4">Pedidos pendientes de pago (placeholder)</div>
        <div className="bg-white rounded shadow p-4">Facturación (placeholder)</div>
        <div className="bg-white rounded shadow p-4">Registro de pagos (placeholder)</div>
      </div>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded shadow p-4">Cierre de caja (placeholder)</div>
        <div className="bg-white rounded shadow p-4">Reportes de ventas (placeholder)</div>
      </div>
    </div>
  )
}
