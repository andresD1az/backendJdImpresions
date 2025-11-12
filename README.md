# JD Impressions Backend - Azure Storage Integration

Este backend implementa la integración con Azure Blob Storage para almacenar las imágenes de productos.

## 🚀 Características

- ✅ Subida de imágenes a Azure Blob Storage
- ✅ Soporte para imagen principal y galería
- ✅ Validación de archivos (solo imágenes)
- ✅ Límite de tamaño: 10MB por archivo
- ✅ Autenticación JWT
- ✅ TypeScript + Express

## 📋 Requisitos Previos

- Node.js >= 18
- Azure Storage Account configurada
- Variables de entorno configuradas

## 🔧 Configuración

### 1. Instalar Dependencias

```powershell
cd backend
npm install
```

### 2. Configurar Variables de Entorno

Copia `.env.example` a `.env` y configura las siguientes variables:

```env
# Azure Storage (REQUERIDO)
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=jdimpressions2025storage;AccountKey=YOUR_KEY_HERE;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="product-images"

# JWT (REQUERIDO)
JWT_SECRET="tu_secreto_jwt_aqui"
JWT_REFRESH_SECRET="tu_secreto_refresh_aqui"

# Configuración de la aplicación
APP_PORT="4000"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"

# Base de datos (si usas Prisma)
DATABASE_URL="postgres://user:pass@localhost:5432/db?schema=public"
```

**IMPORTANTE:** Reemplaza `YOUR_KEY_HERE` con tu clave de Azure Storage.

### 3. Configurar Azure Storage Container

Asegúrate de que el contenedor `product-images` en tu cuenta de Azure Storage:

1. Esté creado
2. Tenga acceso público configurado como "Blob (anonymous read access for blobs only)"
3. O configure CORS si es necesario

## 🏃 Ejecución

### Desarrollo

```powershell
npm run dev
```

### Producción

```powershell
npm run build
npm start
```

## 📝 API Endpoints

### Subir Imagen Individual

**POST** `/manager/uploads`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body:**
```
file: <image_file>
```

**Response:**
```json
{
  "success": true,
  "url": "https://jdimpressions2025storage.blob.core.windows.net/product-images/1234567890-abc123.jpg",
  "filename": "original-filename.jpg"
}
```

### Subir Múltiples Imágenes

**POST** `/manager/uploads/multiple`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body:**
```
files: <image_file_1>
files: <image_file_2>
...
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "url": "https://...",
      "filename": "image1.jpg"
    },
    {
      "url": "https://...",
      "filename": "image2.jpg"
    }
  ]
}
```

## 🔐 Autenticación

Todos los endpoints de `/manager/*` requieren autenticación JWT. El token debe incluirse en el header:

```
Authorization: Bearer <your_jwt_token>
```

El usuario debe tener rol de `admin` o `manager`.

## 📦 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/           # Configuración de la app
│   │   └── index.ts
│   ├── lib/              # Utilidades
│   │   └── azureStorage.ts
│   ├── middleware/       # Middleware de Express
│   │   ├── auth.ts
│   │   └── upload.ts
│   ├── modules/          # Módulos de la aplicación
│   │   └── uploads/
│   │       ├── controller.ts
│   │       └── router.ts
│   ├── app.ts           # Configuración de Express
│   └── server.ts        # Punto de entrada
├── package.json
├── tsconfig.json
└── .env
```

## 🐛 Troubleshooting

### Error: "AZURE_STORAGE_CONNECTION_STRING is not defined"

Asegúrate de que el archivo `.env` existe y contiene la variable `AZURE_STORAGE_CONNECTION_STRING`.

### Error: "Failed to upload file"

Verifica:
1. La conexión a Azure es correcta
2. El contenedor existe
3. Tienes permisos de escritura en el contenedor
4. El archivo no supera 10MB

### Error: "No token provided" o "Invalid token"

El token JWT no está presente o es inválido. Verifica:
1. El token se envía en el header `Authorization: Bearer <token>`
2. El token no ha expirado
3. La variable `JWT_SECRET` es la misma que se usó para generar el token

## 📚 Tecnologías Utilizadas

- **Express** - Framework web
- **TypeScript** - Tipado estático
- **@azure/storage-blob** - SDK de Azure Storage
- **Multer** - Manejo de archivos multipart/form-data
- **JWT** - Autenticación
- **Helmet** - Seguridad HTTP
- **CORS** - Control de acceso entre orígenes
