import React from 'react'

export default function Operativo() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Panel Admin Operativo</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded shadow p-4">Indicadores de ventas (placeholder)</div>
        <div className="bg-white rounded shadow p-4">Productos por agotar (placeholder)</div>
        <div className="bg-white rounded shadow p-4">Pedidos pendientes (placeholder)</div>
      </div>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded shadow p-4">Productos (CRUD parcial)</div>
        <div className="bg-white rounded shadow p-4">Inventario (entradas/salidas)</div>
        <div className="bg-white rounded shadow p-4">Devoluciones</div>
      </div>
    </div>
  )
}
