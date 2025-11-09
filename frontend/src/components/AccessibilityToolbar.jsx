import React, { useEffect, useState, useRef } from 'react'

// Preferences keys
const keys = {
  size: 'a11y:size',
  contrast: 'a11y:contrast',
  grayscale: 'a11y:grayscale',
  underline: 'a11y:underline',
  focus: 'a11y:focus',
  reading: 'a11y:reading',
}

export default function AccessibilityToolbar() {
  const [size, setSize] = useState(() => Number(localStorage.getItem(keys.size) || 100))
  const [contrast, setContrast] = useState(() => localStorage.getItem(keys.contrast) === '1')
  const [grayscale, setGrayscale] = useState(() => localStorage.getItem(keys.grayscale) === '1')
  const [underline, setUnderline] = useState(() => localStorage.getItem(keys.underline) === '1')
  const [focus, setFocus] = useState(() => localStorage.getItem(keys.focus) === '1')
  const [reading, setReading] = useState(() => localStorage.getItem(keys.reading) === '1')
  const announcerRef = useRef(null)

  // Apply preferences to <html>
  useEffect(() => {
    const root = document.documentElement
    root.style.fontSize = `${Math.max(80, Math.min(200, size))}%`
    localStorage.setItem(keys.size, String(size))
  }, [size])
  useEffect(() => { toggleClass('a11y-contrast', contrast); localStorage.setItem(keys.contrast, contrast ? '1' : '0') }, [contrast])
  useEffect(() => { toggleClass('a11y-grayscale', grayscale); localStorage.setItem(keys.grayscale, grayscale ? '1' : '0') }, [grayscale])
  useEffect(() => { toggleClass('a11y-underline', underline); localStorage.setItem(keys.underline, underline ? '1' : '0') }, [underline])
  useEffect(() => { toggleClass('a11y-focus', focus); localStorage.setItem(keys.focus, focus ? '1' : '0') }, [focus])
  useEffect(() => { toggleClass('a11y-reading', reading); localStorage.setItem(keys.reading, reading ? '1' : '0') }, [reading])

  const toggleClass = (cls, on) => document.documentElement.classList.toggle(cls, !!on)
  const announce = (msg) => { if (!announcerRef.current) return; announcerRef.current.textContent = ''; setTimeout(() => { announcerRef.current.textContent = msg }, 10) }

  // Vertical dock UI (right side)
  return (
    <div aria-label="Herramientas de accesibilidad" className="fixed top-1/3 right-2 z-40 select-none">
      <nav className="flex flex-col items-center gap-2 bg-blue-900 text-white rounded-2xl px-2 py-3 shadow-lg" aria-label="Accesibilidad">
        <IconButton label="Modo grises" onClick={()=>{ setGrayscale(v=>!v); announce(!grayscale?'Grises activado':'Grises desactivado') }}>
          <GrayscaleIcon />
        </IconButton>
        <IconButton label="Texto más pequeño" onClick={()=>{ setSize(s=>Math.max(80, s-10)); announce('Texto más pequeño') }}>
          <ABoxMinus />
        </IconButton>
        <IconButton label="Texto más grande" onClick={()=>{ setSize(s=>Math.min(200, s+10)); announce('Texto más grande') }}>
          <ABoxPlus />
        </IconButton>
        <IconButton label="Modo lectura" onClick={()=>{ setReading(v=>!v); announce(!reading?'Modo lectura activado':'Modo lectura desactivado') }}>
          <ReadingIcon />
        </IconButton>
        <IconButton label="Subrayar enlaces" onClick={()=>{ setUnderline(v=>!v); announce(!underline?'Subrayado activado':'Subrayado desactivado') }}>
          <UnderlineIcon />
        </IconButton>
        <button className="mt-1 text-[10px] underline" onClick={()=>{ setSize(100); setContrast(false); setGrayscale(false); setUnderline(false); setFocus(false); setReading(false); announce('Preferencias restablecidas') }}>Reset</button>
      </nav>
      <div ref={announcerRef} aria-live="polite" className="sr-only" />
    </div>
  )
}

function IconButton({ label, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="bg-white text-blue-900 w-10 h-10 rounded-md grid place-items-center shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">
      {children}
    </button>
  )
}

// Simple SVG icons
function GrayscaleIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <defs><linearGradient id="g"><stop offset="0%" stopColor="#000"/><stop offset="100%" stopColor="#ccc"/></linearGradient></defs>
      <rect x="4" y="4" width="16" height="16" rx="2" fill="url(#g)"/>
    </svg>
  )
}
function ABoxMinus(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 16l4-10 4 10" />
      <path d="M9.5 12h5" />
    </svg>
  )
}
function ABoxPlus(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 16l4-10 4 10" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  )
}
function ReadingIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h7a4 4 0 0 1 4 4v8H7a4 4 0 0 0-4 4V6z" />
      <path d="M21 6h-7a4 4 0 0 0-4 4v8h7a4 4 0 0 1 4 4V6z" />
    </svg>
  )
}
function UnderlineIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <path d="M4 20h16" />
    </svg>
  )
}
