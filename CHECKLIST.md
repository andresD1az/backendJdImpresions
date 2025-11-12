# ✅ Checklist de Configuración - Azure Storage

## 🎯 Pasos a Seguir (en orden)

### ☐ Paso 1: Instalar Dependencias
```powershell
cd c:\Users\eyner\CascadeProjects\proyectoFinalJDImpresion\backend
npm install
```
⏱️ Tiempo: ~2 minutos

---

### ☐ Paso 2: Verificar .env
Abre `backend/.env` y confirma que tiene:
```env
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=jdimpressions2025storage;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="product-images"
JWT_SECRET="tu_secreto"
DATABASE_URL="tu_db_url"
```
**Nota:** Reemplaza `YOUR_KEY` con tu clave de Azure Portal.
⏱️ Tiempo: ~1 minuto

---

### ☐ Paso 3: Configurar Acceso Público en Azure
1. Ve a portal.azure.com
2. Storage Account → `jdimpressions2025storage`
3. Containers → `product-images`
4. **"Change access level" → "Blob"**
⏱️ Tiempo: ~2 minutos

---

### ☐ Paso 4: Iniciar Backend
```powershell
cd backend
npm run dev
```
✅ Deberías ver: `🚀 Server is running on port 4000`
⏱️ Tiempo: ~30 segundos

---

### ☐ Paso 5: Probar Subida
1. Inicia el frontend
2. Inicia sesión como admin
3. Ve a Productos → Nuevo Producto
4. Pestaña "Imágenes" → Sube una imagen
5. Verifica que funcione
⏱️ Tiempo: ~3 minutos

---

## 🎉 Listo!

Si todos los pasos tienen ✅, ¡tu integración con Azure Storage está funcionando!

---

## 📞 Ayuda Rápida

| Problema | Solución |
|----------|----------|
| Error al instalar | `npm cache clean --force` y luego `npm install` |
| No encuentra módulos | Verifica que estés en `/backend` |
| Error 403 en imágenes | Configura acceso público del contenedor |
| Token inválido | Cierra sesión y vuelve a iniciar |

---

**¿Todo listo?** Ejecuta: `cd backend && npm install && npm run dev`
