# 🚀 Guía de Deployment a Azure App Service

## Problema Actual

El backend en Azure tiene código antiguo y **no tiene los endpoints de subida de imágenes** (`/manager/uploads`).

## ✅ Solución: Deployment Manual o Automático

### Opción 1: Deployment Automático con GitHub Actions (Recomendado)

#### Paso 1: Obtener Publish Profile de Azure

1. Ve a **Azure Portal** → App Service → `jdimpresion-api`
2. Click en **"Get publish profile"** (arriba)
3. Se descargará un archivo `.PublishSettings`
4. Abre el archivo y copia todo su contenido

#### Paso 2: Configurar Secret en GitHub

1. Ve a tu repo: `https://github.com/andresD1az/backendJdImpresions`
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Nombre: `AZURE_WEBAPP_PUBLISH_PROFILE`
5. Valor: Pega el contenido del archivo `.PublishSettings`
6. Click **"Add secret"**

#### Paso 3: Hacer Push del Workflow

El archivo `.github/workflows/azure-deploy.yml` ya está creado. Solo necesitas:

```powershell
cd c:\Users\eyner\CascadeProjects\backendJdImpresions
git add .github/workflows/azure-deploy.yml DEPLOYMENT_GUIDE.md
git commit -m "chore: Agregar GitHub Actions para deployment a Azure"
git push origin main
```

Esto iniciará el deployment automático a Azure.

---

### Opción 2: Deployment Manual desde VS Code/CLI (Más Rápido)

#### Prerequisitos

```powershell
# Instalar Azure CLI
winget install Microsoft.AzureCLI
```

#### Pasos

1. **Login a Azure:**
```powershell
az login
```

2. **Ir al directorio del backend:**
```powershell
cd c:\Users\eyner\CascadeProjects\backendJdImpresions
```

3. **Build del proyecto:**
```powershell
npm run build
```

4. **Deploy a Azure:**
```powershell
az webapp up --name jdimpresion-api --resource-group <tu-resource-group>
```

O si prefieres ZIP deployment:

```powershell
# Crear package
npm run build
cd dist
npm ci --production

# Crear ZIP
Compress-Archive -Path * -DestinationPath ../deploy.zip

# Deploy
az webapp deployment source config-zip --resource-group <tu-resource-group> --name jdimpresion-api --src ../deploy.zip
```

---

### Opción 3: Configurar Deployment Center en Azure (Configuración Única)

1. **Azure Portal** → App Service → `jdimpresion-api`
2. **Deployment Center** (menú izquierdo)
3. **Source:** Selecciona **GitHub**
4. Autoriza GitHub si es necesario
5. **Organization:** `andresD1az`
6. **Repository:** `backendJdImpresions`
7. **Branch:** `main`
8. Click **"Save"**

Azure automáticamente:
- Detectará que es Node.js/TypeScript
- Ejecutará `npm install`
- Ejecutará `npm run build`
- Desplegará el código

---

## 🔍 Verificar Deployment

Después de cualquier opción, verifica:

```powershell
# Health check
curl https://jdimpresion-api.azurewebsites.net/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "environment": "production"
}
```

### Probar endpoint de uploads

```powershell
# Con tu JWT token
curl -X POST https://jdimpresion-api.azurewebsites.net/manager/uploads \
  -H "Authorization: Bearer TU_TOKEN" \
  -F "file=@test-image.jpg"
```

---

## 📊 Monitoring del Deployment

### GitHub Actions (Opción 1)
- Repo → **Actions** → Ver el workflow corriendo

### Azure Portal (Todas las opciones)
- App Service → **Deployment Center** → **Logs**
- Verás el progreso del deployment

---

## 🐛 Troubleshooting

### Error: "Module not found"
Asegúrate de que `package.json` tenga:
```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js"
  }
}
```

### Error: "Port already in use"
Azure asigna automáticamente el puerto. Verifica `src/server.ts`:
```typescript
const PORT = parseInt(process.env.PORT || config.port, 10);
```

### Deployment no inicia
- Verifica que el Deployment Center esté configurado
- O usa GitHub Actions (Opción 1)
- O deployment manual (Opción 2)

---

## 🎯 Recomendación

**Usa la Opción 1 (GitHub Actions)** porque:
- ✅ Deployment automático en cada push
- ✅ Logs claros en GitHub
- ✅ Fácil de mantener
- ✅ No requiere CLI local

---

## 📝 Checklist de Deployment

- [ ] Obtener Publish Profile de Azure
- [ ] Configurar secret `AZURE_WEBAPP_PUBLISH_PROFILE` en GitHub
- [ ] Push del workflow file
- [ ] Verificar deployment en Actions
- [ ] Probar `/health` endpoint
- [ ] Probar `/manager/uploads` endpoint

---

**Siguiente paso:** Elige una opción y ejecuta el deployment. ¡El código ya está listo en GitHub! 🚀
