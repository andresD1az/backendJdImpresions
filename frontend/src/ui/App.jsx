import React, { useEffect, useRef, useState } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from '../pages/Login.jsx'
import Register from '../pages/Register.jsx'
import VerifyEmail from '../pages/VerifyEmail.jsx'
import RequestReset from '../pages/RequestReset.jsx'
import ResetPassword from '../pages/ResetPassword.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import Locked from '../pages/Locked.jsx'
import ClientHome from '../pages/ClientHome.jsx'
import AdminEmployees from '../pages/AdminEmployees.jsx'
import ChangePassword from '../pages/ChangePassword.jsx'
import Manager from '../pages/Manager.jsx'
import Bodega from '../pages/Bodega.jsx'
import Surtido from '../pages/Surtido.jsx'
const Descargue = () => <div className="max-w-3xl mx-auto p-4"> <h1 className="text-2xl font-semibold">Panel Descargue</h1><p className="mt-2 text-gray-600">Tareas de descargue.</p></div>
import { AuthProvider, useAuth } from '../context/AuthContext.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import useActivityPing from '../hooks/useActivityPing.js'
import Profile from '../pages/Profile.jsx'
import Inventory from '../pages/Inventory.jsx'
import ProductEditor from '../pages/ProductEditor.jsx'
import AccessibilityToolbar from '../components/AccessibilityToolbar.jsx'
import StoreCatalog from '../pages/StoreCatalog.jsx'
import Cart from '../pages/Cart.jsx'
import ProductDetailSlug from '../pages/ProductDetailSlug.jsx'
import MyOrders from '../pages/MyOrders.jsx'
import Operativo from '../pages/Operativo.jsx'
import Ventas from '../pages/Ventas.jsx'
import Caja from '../pages/Caja.jsx'
import Soporte from '../pages/Soporte.jsx'
import ClientInvoices from '../pages/ClientInvoices.jsx'
import ClientReturns from '../pages/ClientReturns.jsx'
import ProductDetail from '../pages/ProductDetail.jsx'
import PermissionGuard from '../app/router/guards/PermissionGuard.jsx'
import PermAny from '../app/router/guards/PermAny.jsx'
import Terms from '../pages/Terms.jsx'

function Nav() {
  const { token, user, logout } = useAuth()
  const role = (user?.role || '').toLowerCase()
  const homePath = !token ? '/' : (
    role === 'manager' ? '/manager'
    : role === 'bodega' ? '/bodega'
    : role === 'surtido' ? '/surtido'
    : role === 'descargue' ? '/descargue'
    : role === 'client' ? '/tienda'
    : '/dashboard'
  )
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <nav className="p-4 flex items-center justify-between bg-white shadow">
      <div className="flex gap-4 items-center">
        <Link className="font-semibold" to={homePath}>Inicio</Link>
        {token && (
          <>
            {role === 'manager' && <Link to="/admin/empleados">Empleados</Link>}
            {role === 'manager' && <Link to="/inventario">Inventario</Link>}
            {(role === 'manager' || role === 'surtido') && <Link to="/surtido">Surtidos</Link>}
            {(role === 'manager' || role === 'bodega') && <Link to="/bodega">Bodega</Link>}
            {role === 'descargue' && <Link to="/descargue">Descargue</Link>}
            {(role === 'client' || role === 'manager') && <Link to="/tienda">Tienda</Link>}
            {(role === 'client' || role === 'manager') && <Link to="/carrito">Carrito</Link>}
            {(role === 'client' || role === 'manager') && <Link to="/mis-pedidos">Mis pedidos</Link>}
            {(role === 'client' || role === 'manager') && <Link to="/mis-facturas">Mis facturas</Link>}
            {(role === 'client' || role === 'manager') && <Link to="/mis-devoluciones">Mis devoluciones</Link>}
            {role === 'manager' && <Link to="/operativo">Operativo</Link>}
            {role === 'manager' && <Link to="/ventas">Ventas</Link>}
            {role === 'manager' && <Link to="/caja">Caja</Link>}
            {role === 'manager' && <Link to="/soporte">Soporte</Link>}
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {!token && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Registro</Link>
          </>
        )}
        {token && (
          <div className="relative" ref={menuRef}>
            <button aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 focus:outline-none" onClick={()=>setOpen(o=>!o)}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                  {(user?.full_name || user?.email || 'U').slice(0,1).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:block">{user?.full_name || user?.email}</span>
            </button>
            {open && (
              <div role="menu" className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg border">
                <Link role="menuitem" className="block px-3 py-2 hover:bg-gray-50" to="/profile" onClick={()=>setOpen(false)}>Perfil</Link>
                <Link role="menuitem" className="block px-3 py-2 hover:bg-gray-50" to="/settings/password" onClick={()=>setOpen(false)}>Cambiar contraseña</Link>
                <button role="menuitem" className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600" onClick={()=>{ setOpen(false); logout() }}>Cerrar sesión</button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

function AdminNav() {
  const { token, user, logout } = useAuth()
  const role = (user?.role || '').toLowerCase()
  const perms = user?.perms || []
  const can = p => perms.includes(p)
  const itemsBase = []
  if (role === 'manager' || can('report:view')) itemsBase.push({ label: 'Inicio', to: '/manager' })
  if (role === 'manager' || can('user:manage')) itemsBase.push({ label: 'Empleados', to: '/admin/empleados' })
  if (role === 'manager' || can('inventory:view')) itemsBase.push({ label: 'Productos', to: '/admin/productos' })
  if (role === 'manager') itemsBase.push({ label: 'Operativo', to: '/operativo' })
  if (role === 'manager' || can('product:view')) itemsBase.push({ label: 'Ventas', to: '/ventas' })
  if (role === 'manager' || can('payment:reconcile') || can('invoice:emit')) itemsBase.push({ label: 'Caja', to: '/caja' })
  if (role === 'manager' || can('return:manage')) itemsBase.push({ label: 'Devoluciones', to: '/soporte' })
  // Específicos por rol operativo
  if (role === 'bodega') itemsBase.push({ label: 'Bodega', to: '/bodega' })
  if (role === 'surtido') itemsBase.push({ label: 'Surtido', to: '/surtido' })
  if (role === 'descargue') itemsBase.push({ label: 'Descargue', to: '/descargue' })
  const items = itemsBase.length ? itemsBase : [{ label: 'Dashboard', to: '/dashboard' }]

  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    function onDocClick(e) { if (!menuRef.current) return; if (!menuRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <nav className="p-4 flex items-center justify-between bg-white shadow">
      <div className="flex gap-6 items-center">
        <Link className="font-semibold" to={items[0]?.to || '/dashboard'}>Panel</Link>
        {token && (
          <div className="hidden md:flex items-center gap-4 text-sm">
            {items.map(it => (<Link key={it.to} to={it.to} className="hover:underline">{it.label}</Link>))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {token && (
          <div className="relative" ref={menuRef}>
            <button aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 focus:outline-none" onClick={()=>setOpen(o=>!o)}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                  {(user?.full_name || user?.email || 'U').slice(0,1).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:block">{user?.full_name || user?.email}</span>
            </button>
            {open && (
              <div role="menu" className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg border">
                <Link role="menuitem" className="block px-3 py-2 hover:bg-gray-50" to="/profile" onClick={()=>setOpen(false)}>Perfil</Link>
                <Link role="menuitem" className="block px-3 py-2 hover:bg-gray-50" to="/settings/password" onClick={()=>setOpen(false)}>Cambiar contraseña</Link>
                <button role="menuitem" className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600" onClick={()=>{ setOpen(false); logout() }}>Cerrar sesión</button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

export function ClientShell({ children }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [q, setQ] = useState('')
  const [cartCount, setCartCount] = useState(0)
  // User menu state (avatar dropdown)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    const read = () => {
      try { const raw = localStorage.getItem('cart'); const arr = raw? JSON.parse(raw):[]; setCartCount(arr.reduce((a,b)=>a+Number(b.quantity||0),0)) } catch { setCartCount(0) }
    }
    read()
    const onStorage = (e) => { if (e.key === 'cart') read() }
    const onCustom = () => read()
    window.addEventListener('storage', onStorage)
    window.addEventListener('cart-updated', onCustom)
    const onDocClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('cart-updated', onCustom) }
  }, [])
  const goSearch = () => navigate(`/tienda${q?`?q=${encodeURIComponent(q)}`:''}`)
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/inicio" className="font-semibold text-lg">JD Impressions</Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-gray-700">
              <Link to="/tienda" className="hover:text-blue-700">Tienda</Link>
              <Link to="/tienda/escuela" className="hover:text-blue-700">escuela</Link>
              <Link to="/tienda/arte" className="hover:text-blue-700">arte</Link>
              <Link to="/tienda/oficina" className="hover:text-blue-700">oficina</Link>
              <Link to="/tienda/tecnologia" className="hover:text-blue-700">tecnología</Link>
              <Link to="/tienda/papeleria" className="hover:text-blue-700">papelería</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <input className="border rounded px-3 py-1.5 w-64" placeholder="Buscar productos..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&goSearch()} />
              <button className="border rounded px-3 py-1.5 hover:bg-gray-50" onClick={goSearch}>Buscar</button>
            </div>
            <Link to="/carrito" className="relative border rounded px-3 py-1.5 hover:bg-gray-50">
              Carrito
              {cartCount>0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">{cartCount}</span>
              )}
            </Link>
            {!user && (
              <Link to="/login" className="border rounded px-3 py-1.5 hover:bg-gray-50">Iniciar sesión</Link>
            )}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  className="flex items-center gap-2 border rounded px-2 py-1.5 hover:bg-gray-50"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={()=>setMenuOpen(o=>!o)}
                >
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                      {(user?.full_name || user?.email || 'U').slice(0,1).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm">{user?.full_name || user?.email}</span>
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-56 bg-white rounded shadow-lg border z-20">
                    <div className="px-3 py-2 text-xs text-gray-500">Cuenta</div>
                    {user?.role?.toLowerCase?.() === 'manager' && (
                      <Link role="menuitem" to="/manager" className="block px-3 py-2 hover:bg-gray-50" onClick={()=>setMenuOpen(false)}>Panel gerente</Link>
                    )}
                    <Link role="menuitem" to="/cuenta" className="block px-3 py-2 hover:bg-gray-50" onClick={()=>setMenuOpen(false)}>Área personal</Link>
                    <Link role="menuitem" to="/mis-pedidos" className="block px-3 py-2 hover:bg-gray-50" onClick={()=>setMenuOpen(false)}>Mis compras</Link>
                    <Link role="menuitem" to="/mis-facturas" className="block px-3 py-2 hover:bg-gray-50" onClick={()=>setMenuOpen(false)}>Mis facturas</Link>
                    <Link role="menuitem" to="/mis-devoluciones" className="block px-3 py-2 hover:bg-gray-50" onClick={()=>setMenuOpen(false)}>Mis devoluciones</Link>
                    <Link role="menuitem" to="/cuenta/password" className="block px-3 py-2 hover:bg-gray-50" onClick={()=>setMenuOpen(false)}>Cambiar contraseña</Link>
                    <Link role="menuitem" to="/terminos" className="block px-3 py-2 hover:bg-gray-50" onClick={()=>setMenuOpen(false)}>Términos y privacidad</Link>
                    <div className="border-t my-1" />
                    <button role="menuitem" className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600" onClick={()=>{ setMenuOpen(false); logout() }}>Cerrar sesión</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
      <footer className="border-t py-8 text-sm text-gray-600">
        <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <div className="font-semibold mb-2">JD Impressions</div>
            <div>jdimpresions@gmail.com</div>
          </div>
          <div>
            <div className="font-semibold mb-2">Tienda</div>
            <ul className="space-y-1">
              <li><a href="/tienda" className="hover:underline">Productos</a></li>
              <li><a href="/mis-pedidos" className="hover:underline">Mis pedidos</a></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Soporte</div>
            <ul className="space-y-1">
              <li>WhatsApp</li>
              <li>Política de devoluciones</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Legal</div>
            <ul className="space-y-1">
              <li>Política de privacidad</li>
              <li>Términos de uso</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6"> 2025 JD Impressions. Todos los derechos reservados.</div>
      </footer>
    </div>
  )
}

export function AdminLayout() {
  const { token, user, fetchMe } = useAuth()
  const role = (user?.role || '').toLowerCase()
  const location = useLocation()
  // Call hook at top level with enabled flag
  useActivityPing({ minIntervalMs: 20000, checkIntervalMs: 15000, enabled: role !== 'client' })
  React.useEffect(() => {
    if (token && !user) fetchMe()
  }, [token])
  if (role === 'client') return <Navigate to="/inicio" replace />
  const defaultPathByRole = {
    manager: '/manager',
    bodega: '/bodega',
    surtido: '/surtido',
    descargue: '/descargue',
    cajero: '/caja',
    soporte: '/soporte',
    operativo: '/operativo',
    vendedor: '/ventas',
  }
  const wantRedirect = ['/dashboard','/admin','/'].includes(location.pathname)
  const target = defaultPathByRole[role]
  if (target && wantRedirect) return <Navigate to={target} replace />
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white border px-3 py-1 rounded shadow">Saltar al contenido principal</a>
      <AdminNav />
      <AccessibilityToolbar />
      <main id="main" className="flex-1 p-6" role="main">
        <Routes>
          <Route path="/" element={<Navigate to="/inicio" />} />
          
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/password/request" element={<RequestReset />} />
          <Route path="/password/reset" element={<ResetPassword />} />

          {/* Role-specific dashboards */}
          <Route path="/manager" element={<ProtectedRoute roles={['manager']}><Manager /></ProtectedRoute>} />
          <Route path="/bodega" element={<ProtectedRoute roles={['bodega','manager']}><Bodega /></ProtectedRoute>} />
          <Route path="/descargue" element={<ProtectedRoute roles={['descargue','manager']}><Descargue /></ProtectedRoute>} />
          <Route path="/surtido" element={<ProtectedRoute roles={['surtido','manager']}><Surtido /></ProtectedRoute>} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/locked" element={<ProtectedRoute allowLocked><Locked /></ProtectedRoute>} />
          <Route path="/operativo" element={<ProtectedRoute roles={['manager']}><Operativo /></ProtectedRoute>} />
          <Route path="/ventas" element={<ProtectedRoute roles={['manager']}><Ventas /></ProtectedRoute>} />
          <Route path="/caja" element={<PermAny perms={["invoice:emit","payment:reconcile"]}><Caja /></PermAny>} />
          <Route path="/soporte" element={<ProtectedRoute roles={['manager']}><Soporte /></ProtectedRoute>} />
          <Route path="/admin/empleados" element={<ProtectedRoute roles={['manager']}><AdminEmployees /></ProtectedRoute>} />
          <Route path="/admin/productos" element={<ProtectedRoute roles={['manager','bodega','surtido']}><Inventory /></ProtectedRoute>} />
          <Route path="/admin/productos/nuevo" element={<ProtectedRoute roles={['manager']}><ProductEditor /></ProtectedRoute>} />
          <Route path="/admin/productos/:id/editar" element={<ProtectedRoute roles={['manager']}><ProductEditor /></ProtectedRoute>} />
          {/* Backward compatibility old route */}
          <Route path="/inventario" element={<ProtectedRoute roles={['manager','bodega','surtido']}><Inventory /></ProtectedRoute>} />
          <Route path="/settings/password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      {/* Rutas separadas por layout */}
      <Routes>
        {/* Redirect raíz a landing */}
        <Route path="/" element={<Navigate to="/inicio" replace />} />
        {/* Client storefront layout: público como landing */}
        <Route path="/inicio" element={<ClientShell><ClientHome /></ClientShell>} />
        <Route path="/productos" element={<ClientShell><StoreCatalog /></ClientShell>} />
        <Route path="/tienda" element={<ClientShell><StoreCatalog /></ClientShell>} />
        <Route path="/tienda/:categoria" element={<ClientShell><StoreCatalog /></ClientShell>} />
        <Route path="/producto-slug/:slug" element={<ClientShell><ProductDetailSlug /></ClientShell>} />
        <Route path="/producto/:sku" element={<ClientShell><ProductDetail /></ClientShell>} />
        <Route path="/carrito" element={<ClientShell><Cart /></ClientShell>} />
        <Route path="/mis-pedidos" element={<ProtectedRoute roles={['client','manager']}><ClientShell><MyOrders /></ClientShell></ProtectedRoute>} />
        <Route path="/mis-facturas" element={<ProtectedRoute roles={['client','manager']}><ClientShell><ClientInvoices /></ClientShell></ProtectedRoute>} />
        <Route path="/mis-devoluciones" element={<ProtectedRoute roles={['client','manager']}><ClientShell><ClientReturns /></ClientShell></ProtectedRoute>} />
        {/* Account pages for client under storefront layout */}
        <Route path="/cuenta" element={<ProtectedRoute roles={['client','manager']}><ClientShell><Profile /></ClientShell></ProtectedRoute>} />
        <Route path="/cuenta/password" element={<ProtectedRoute roles={['client','manager']}><ClientShell><ChangePassword /></ClientShell></ProtectedRoute>} />
        {/* Public legal page within storefront */}
        <Route path="/terminos" element={<ClientShell><Terms /></ClientShell>} />

        {/* Admin and auth layout */}
        <Route path="*" element={<AdminLayout />} />
      </Routes>
    </AuthProvider>
  )
}
