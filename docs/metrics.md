# Métricas de Calidad

Este documento define las métricas de calidad del proceso (3.3) y las métricas de negocio (3.4) que aplicaremos al sistema.

## 3.3 Métricas para la Calidad de un Proceso

- __Defectos por módulo__
  - Descripción: Defectos detectados en autenticación e inventario durante pruebas.
  - Fórmula / Unidad: Total de defectos / módulo (conteo)
  - Fuente de datos: Reportes de pruebas, issues del tracker
  - Frecuencia de medición: Por iteración

- __Cobertura de pruebas__
  - Descripción: Porcentaje de código cubierto por pruebas unitarias, de integración y E2E.
  - Fórmula / Unidad: (Líneas cubiertas / Total líneas) × 100%
  - Fuente de datos: Herramientas de testing (coverage)
  - Frecuencia de medición: En cada build/release

- __MTTR (tiempo medio de reparación)__
  - Descripción: Tiempo promedio para corregir defectos reportados.
  - Fórmula / Unidad: ∑ tiempo de corrección / nº defectos (horas)
  - Fuente de datos: Tracker de issues
  - Frecuencia de medición: Por iteración / mensual

- __Tasa de éxito de login__
  - Descripción: Logins exitosos sobre intentos totales.
  - Fórmula / Unidad: (logins válidos / intentos) × 100%
  - Fuente de datos: Logs API (pino)
  - Frecuencia de medición: Semanal

- __Rechazos por seguridad en login__
  - Descripción: Porcentaje de intentos bloqueados (CAPTCHA, rate limiting, credenciales inválidas).
  - Fórmula / Unidad: (rechazos / intentos) × 100%
  - Fuente de datos: Logs de seguridad
  - Frecuencia de medición: Semanal

- __p95 de respuesta en endpoints críticos__
  - Descripción: Latencia en login e inventario.
  - Fórmula / Unidad: p95 (ms)
  - Fuente de datos: Access logs / APM
  - Frecuencia de medición: Diario

- __Exactitud de inventario__
  - Descripción: Diferencia entre stock teórico y real.
  - Fórmula / Unidad: |stock teórico – stock real| / stock real × 100%
  - Fuente de datos: Conteo físico vs DB
  - Frecuencia de medición: Mensual / por auditoría

- __Cobertura de auditoría de movimientos__
  - Descripción: Operaciones de stock registradas en tabla de movimientos.
  - Fórmula / Unidad: (movimientos registrados / operaciones) × 100%
  - Fuente de datos: DB (inventory_movements)
  - Frecuencia de medición: Semanal

- __Cambios fallidos (Change Failure Rate)__
  - Descripción: Porcentaje de despliegues con rollback/incidentes.
  - Fórmula / Unidad: (despliegues fallidos / totales) × 100%
  - Fuente de datos: CI/CD
  - Frecuencia de medición: Por release

- __Lead time para cambios__
  - Descripción: Tiempo entre commit y despliegue.
  - Fórmula / Unidad: Horas/días promedio
  - Fuente de datos: CI/CD
  - Frecuencia de medición: Por release

- __Incidentes de seguridad__
  - Descripción: Número de eventos relevantes (bloqueos, intentos anómalos, denegaciones).
  - Fórmula / Unidad: Conteo
  - Fuente de datos: Logs de seguridad
  - Frecuencia de medición: Mensual

## 3.4 Creación de Métricas para la Calidad (Negocio)

- __Tiempo de registro de pedido__
  - Proceso asociado: Gestión de Ventas
  - Descripción: Tiempo promedio que tarda un usuario en registrar un pedido completo.
  - Fórmula / Criterio: Tiempo total de registro / Nº de pedidos
  - Interpretación esperada: < 3 minutos

- __Exactitud en la captura de datos__
  - Proceso asociado: Gestión de Ventas
  - Descripción: % de pedidos registrados sin errores de información (cliente, producto, cantidad).
  - Fórmula / Criterio: (Pedidos sin error / Total de pedidos) × 100
  - Interpretación esperada: ≥ 97%

- __Cumplimiento en confirmación de pedidos__
  - Proceso asociado: Gestión de Ventas
  - Descripción: % de pedidos confirmados dentro del tiempo establecido.
  - Fórmula / Criterio: (Pedidos confirmados a tiempo / Total pedidos) × 100
  - Interpretación esperada: ≥ 95%

- __Nivel de satisfacción del cliente__
  - Proceso asociado: Gestión de Ventas
  - Descripción: Calificación promedio de clientes respecto al proceso de compra (encuesta post-pedido).
  - Fórmula / Criterio: Promedio de calificaciones (escala 1 a 5)
  - Interpretación esperada: ≥ 4.5 / 5

- __Tasa de pedidos cancelados__
  - Proceso asociado: Gestión de Ventas
  - Descripción: % de pedidos cancelados por errores, demoras o falta de stock.
  - Fórmula / Criterio: (Pedidos cancelados / Total pedidos) × 100
  - Interpretación esperada: < 5%

---

## Plan de Instrumentación (resumen)

- __Logs estructurados__: asegurar que login/inventario registren intentos, éxito/fracaso, razones (pino Logger).  
- __Métricas de latencia__: recolectar p95 de login/inventario (APM o cálculo vía access logs).  
- __Auditoría de inventario__: ya contamos con `inventory_movements` y `price_change_logs`.  
- __Cobertura__: integrar coverage en CI para publicar % por build.  
- __MTTR y defectos__: referenciar tiempos y estados desde el tracker de issues.  
- __CI/CD__: exponer tasa de cambios fallidos y lead time desde el pipeline.

> Nota: Este documento es el “qué medir”. En siguientes tareas añadiremos dashboards (Grafana/Looker Studio) y scripts de agregación.
