# 🚀 Inicio Rápido - Backend con Azure Storage

## ⚡ Instalación en 3 Pasos

### Paso 1: Instalar Dependencias

```powershell
cd backend
npm install
```

### Paso 2: Configurar Variables de Entorno

Edita el archivo `.env` y agrega tus credenciales de Azure:

```env
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=jdimpressions2025storage;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="product-images"
```

**Nota:** Reemplaza `YOUR_KEY` con tu clave de Azure Portal (Access Keys).

### Paso 3: Ejecutar el Servidor

```powershell
npm run dev
```

## ✅ Verificar que Funciona

1. El servidor debería iniciar en `http://localhost:4000`
2. Verifica el health check: `http://localhost:4000/health`
3. Deberías ver en la consola:
   ```
   🚀 Server is running on port 4000
   ☁️  Azure Storage Container: product-images
   ```

## 🎯 Probar la Subida de Imágenes

1. Inicia el frontend
2. Inicia sesión como administrador
3. Ve a "Productos" → "Nuevo Producto"
4. En la pestaña "Imágenes", sube una imagen
5. La imagen se guardará en Azure Storage y verás la URL generada

## 📝 Endpoints Disponibles

- **GET** `/health` - Health check (no requiere auth)
- **POST** `/manager/uploads` - Subir imagen individual (requiere auth)
- **POST** `/manager/uploads/multiple` - Subir múltiples imágenes (requiere auth)

## 🔧 Comandos Útiles

```powershell
# Desarrollo (con hot-reload)
npm run dev

# Compilar TypeScript
npm run build

# Producción
npm start
```

## 📚 Documentación Completa

- Ver `README.md` para documentación técnica completa
- Ver `../AZURE_STORAGE_SETUP.md` para guía detallada de Azure

## ❓ Problemas Comunes

### No encuentra el módulo '@azure/storage-blob'
```powershell
npm install
```

### Error de conexión a Azure
Verifica que `AZURE_STORAGE_CONNECTION_STRING` en `.env` sea correcta.

### Las imágenes no se muestran (403)
En Azure Portal, cambia el nivel de acceso del contenedor a "Blob (anonymous read access)".

## 🎉 ¡Listo!

Tu backend ahora está completamente configurado para almacenar imágenes en Azure Blob Storage.
