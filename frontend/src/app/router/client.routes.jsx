import React from 'react'
import { createBrowserRouter } from 'react-router-dom'
import ClientHome from '../../pages/ClientHome.jsx'
import StoreCatalog from '../../pages/StoreCatalog.jsx'
import ProductDetail from '../../pages/ProductDetail.jsx'
import Cart from '../../pages/Cart.jsx'
import MyOrders from '../../pages/MyOrders.jsx'
import ClientInvoices from '../../pages/ClientInvoices.jsx'
import ClientReturns from '../../pages/ClientReturns.jsx'
import ClientShell from '../../ui/App.jsx'

// We will mount ClientShell by composition: element receives children via routes in App.jsx
// Here we export a router for client-only tree if used standalone
export const clientRouter = createBrowserRouter([
  {
    path: '/',
    element: <ClientShell />,
    children: [
      { index: true, element: <ClientHome /> },
      { path: 'tienda', element: <StoreCatalog /> },
      { path: 'producto/:sku', element: <ProductDetail /> },
      { path: 'carrito', element: <Cart /> },
      { path: 'mis-pedidos', element: <MyOrders /> },
      { path: 'mis-facturas', element: <ClientInvoices /> },
      { path: 'mis-devoluciones', element: <ClientReturns /> },
    ],
  },
])
