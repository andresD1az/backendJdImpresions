import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './ui/App.jsx'
import './index.css'
import { initTelemetry } from './telemetry.js'

// Initialize Application Insights telemetry
initTelemetry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
