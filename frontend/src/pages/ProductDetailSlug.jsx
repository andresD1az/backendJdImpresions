import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import ProductDetail from './ProductDetail'

export default function ProductDetailSlug() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(()=>{
    (async ()=>{
      setLoading(true); setErr('')
      try {
        const preview = new URLSearchParams(window.location.search).get('preview')
        const res = await api(`/store/product-slug/${encodeURIComponent(slug)}${preview?'?preview=1':''}`)
        setData(res?.product || null)
      } catch (e) { setErr('Producto no encontrado') }
      finally { setLoading(false) }
    })()
  }, [slug])

  if (loading) return <div className="max-w-5xl mx-auto">Cargando...</div>
  if (err) return <div className="max-w-5xl mx-auto text-red-600">{err}</div>
  if (!data) return <div className="max-w-5xl mx-auto text-gray-600">Producto no encontrado</div>

  // Reutilizamos el componente existente, mapeando el objeto esperado
  return <ProductDetail initialProduct={data} />
}
