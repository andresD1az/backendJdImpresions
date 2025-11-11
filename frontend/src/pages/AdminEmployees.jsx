import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { trackEvent } from '../telemetry'

export default function AdminEmployees() {
  const { token, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [securityCode, setSecurityCode] = useState('')
  const [role, setRole] = useState('bodega')
  // profile fields
  const [rut, setRut] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [findings, setFindings] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState('')
  const [filterQ, setFilterQ] = useState('')
  const [filterRole, setFilterRole] = useState('') // '', 'bodega','surtido','descargue','manager'
  const [filterStatus, setFilterStatus] = useState('') // '', 'active','suspended'
  const [roleEdits, setRoleEdits] = useState({}) // { [id]: role }
  const [roleMsg, setRoleMsg] = useState('')
  const [roleErr, setRoleErr] = useState('')

  const loadEmployees = async () => {
    setLoadingList(true)
    setListError('')
    try {
      const res = await api('/auth/admin/employees', { token })
      let rows = res.employees || []
      // Filtros del lado del cliente por ahora
      if (filterQ) {
        const q = filterQ.toLowerCase()
        rows = rows.filter(e => (e.email||'').toLowerCase().includes(q) || (e.full_name||'').toLowerCase().includes(q))
      }
      if (filterRole) rows = rows.filter(e => e.role === filterRole)
      if (filterStatus) rows = rows.filter(e => (e.status||'') === filterStatus)
      setEmployees(rows)
    } catch (e) {
      console.error('employees_list_error', e)
      setListError('No se pudo cargar el listado de empleados')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => { if (token) loadEmployees() }, [token, filterQ, filterRole, filterStatus])

  const saveRole = async (empId) => {
    setRoleMsg(''); setRoleErr('')
    const newRole = roleEdits[empId]
    if (!newRole) return
    const employee = employees.find(e => e.id === empId);
    const oldRole = employee?.role;
    try {
      await api(`/auth/admin/employee/${empId}/role`, {
        method: 'PATCH', token, body: { newRole }
      })
      setRoleMsg('Rol actualizado')
      const next = { ...roleEdits }; delete next[empId]; setRoleEdits(next)
      trackEvent('employee_role_change_frontend', { employeeId: empId, fromRole: oldRole, toRole: newRole });
      loadEmployees()
    } catch (e) {
      trackEvent('employee_role_change_failed', { employeeId: empId, error: e?.data?.error });
      setRoleErr(e?.data?.error || 'change_role_error')
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const res = await api('/auth/admin/create-employee', {
        method: 'POST', token,
        body: { email, password, fullName, securityCode, role, rut, nationalId, bloodType, findings, birthDate, experienceYears }
      })
      setMsg(`Empleado creado: ${res.user.email} (${res.user.role})`)
      setEmail(''); setPassword(''); setFullName(''); setSecurityCode(''); setRole('bodega')
      setRut(''); setNationalId(''); setBloodType(''); setFindings(''); setBirthDate(''); setExperienceYears('')
      loadEmployees()
    } catch (e) {
      setError(e?.data?.error || 'create_employee_error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Gestión de empleados</h1>
      {msg && <div className="mb-3 text-green-700">{msg}</div>}
      {error && <div className="mb-3 text-red-600">{error}</div>}
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Correo</label>
          <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Nombre completo</label>
          <input className="w-full border rounded px-3 py-2" type="text" value={fullName} onChange={e=>setFullName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Contraseña</label>
          <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">PIN de seguridad (desbloqueo)</label>
          <input className="w-full border rounded px-3 py-2" type="text" value={securityCode} onChange={e=>setSecurityCode(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Rol</label>
          <select className="w-full border rounded px-3 py-2" value={role} onChange={e=>setRole(e.target.value)}>
            <option value="bodega">Empleado bodega</option>
            <option value="descargue">Empleado descargue</option>
            <option value="surtido">Empleado surtido</option>
            <option value="manager">Gerente</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">RUT</label>
          <input className="w-full border rounded px-3 py-2" value={rut} onChange={e=>setRut(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Cédula</label>
          <input className="w-full border rounded px-3 py-2" value={nationalId} onChange={e=>setNationalId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Tipo de sangre</label>
          <input className="w-full border rounded px-3 py-2" value={bloodType} onChange={e=>setBloodType(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Hallazgos</label>
          <textarea className="w-full border rounded px-3 py-2" rows={2} value={findings} onChange={e=>setFindings(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Fecha de nacimiento</label>
          <input className="w-full border rounded px-3 py-2" type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Años de experiencia</label>
          <input className="w-full border rounded px-3 py-2" type="number" min="0" value={experienceYears} onChange={e=>setExperienceYears(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">Crear empleado</button>
        </div>
      </form>

      <hr className="my-6" />
      <h2 className="text-xl font-semibold mb-3">Listado de empleados</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <input className="border rounded px-3 py-2" placeholder="Buscar por nombre o correo" value={filterQ} onChange={e=>setFilterQ(e.target.value)} />
        <select className="border rounded px-3 py-2" value={filterRole} onChange={e=>setFilterRole(e.target.value)}>
          <option value="">Todos los roles</option>
          <option value="bodega">Bodega</option>
          <option value="surtido">Surtido</option>
          <option value="descargue">Descargue</option>
          <option value="manager">Gerente</option>
        </select>
        <select className="border rounded px-3 py-2" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="suspended">Suspendido</option>
        </select>
        <button className="border rounded px-3 py-2" onClick={loadEmployees}>Refrescar</button>
      </div>
      {listError && <div className="mb-3 text-red-600">{listError}</div>}
      {roleErr && <div className="mb-3 text-red-600">{roleErr}</div>}
      {roleMsg && <div className="mb-3 text-green-700">{roleMsg}</div>}
      {loadingList ? <div>Cargando...</div> : (
        <div className="overflow-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 border">Nombre</th>
                <th className="px-3 py-2 border">Correo</th>
                <th className="px-3 py-2 border">Rol</th>
                <th className="px-3 py-2 border">Estado</th>
                <th className="px-3 py-2 border">Cédula</th>
                <th className="px-3 py-2 border">Sangre</th>
                <th className="px-3 py-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td className="px-3 py-2 border">{emp.full_name || '-'}</td>
                  <td className="px-3 py-2 border">{emp.email}</td>
                  <td className="px-3 py-2 border">
                    <div className="flex items-center gap-2">
                      <select
                        className="border rounded px-2 py-1"
                        value={roleEdits[emp.id] ?? emp.role}
                        onChange={e=>setRoleEdits(prev=>({ ...prev, [emp.id]: e.target.value }))}
                        disabled={user?.id === emp.id}
                      >
                        <option value="manager">Gerente</option>
                        <option value="bodega">Bodega</option>
                        <option value="surtido">Surtido</option>
                        <option value="descargue">Descargue</option>
                        <option value="vendedor">Vendedor</option>
                        <option value="cajero">Cajero</option>
                        <option value="soporte">Soporte</option>
                        <option value="operativo">Operativo</option>
                      </select>
                      <button
                        className="text-blue-700 disabled:text-gray-400"
                        onClick={()=>saveRole(emp.id)}
                        disabled={user?.id === emp.id || (roleEdits[emp.id] ?? emp.role) === emp.role}
                        title={user?.id === emp.id ? 'No puedes cambiar tu propio rol' : 'Guardar rol'}
                      >Guardar</button>
                    </div>
                  </td>
                  <td className="px-3 py-2 border">{emp.status}</td>
                  <td className="px-3 py-2 border">{emp.national_id || '-'}</td>
                  <td className="px-3 py-2 border">{emp.blood_type || '-'}</td>
                  <td className="px-3 py-2 border space-x-2">
                    {emp.status === 'active' ? (
                      <button className="text-yellow-700" onClick={async ()=>{ await api(`/auth/admin/employees/${emp.id}`, { method:'PATCH', token, body:{ status:'suspended' } }); loadEmployees() }}>Suspender</button>
                    ) : (
                      <button className="text-green-700" onClick={async ()=>{ await api(`/auth/admin/employees/${emp.id}`, { method:'PATCH', token, body:{ status:'active' } }); loadEmployees() }}>Reactivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
