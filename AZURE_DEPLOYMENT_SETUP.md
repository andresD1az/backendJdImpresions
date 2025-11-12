# Configuración de Deployment a Azure

## Estado Actual
⚠️ El workflow de deployment está **DESHABILITADO** temporalmente para evitar fallos en CI.

## Cómo Obtener el Publish Profile (3 Métodos)

### Método 1: Azure Portal (Web)
1. Ve a: https://portal.azure.com
2. Busca "App Services" → Click en `jdimpresion-api`
3. En el menú superior, busca el botón **"Get publish profile"** o **"⬇ Descargar perfil de publicación"**
4. Guarda el archivo `.PublishSettings`

**Si no funciona el botón:** Intenta con otro navegador o en modo incógnito.

### Método 2: Azure CLI (Línea de Comandos)
```powershell
# Instalar Azure CLI si no lo tienes
winget install Microsoft.AzureCLI

# Login
az login

# Descargar el publish profile
az webapp deployment list-publishing-profiles `
  --name jdimpresion-api `
  --resource-group <TU_RESOURCE_GROUP> `
  --xml > jdimpresion-api.PublishSettings
```

**Nota:** Reemplaza `<TU_RESOURCE_GROUP>` con tu resource group (lo ves en Azure Portal).

### Método 3: Desde Visual Studio Code (si tienes la extensión)
1. Instala la extensión "Azure App Service"
2. Click en el ícono de Azure en la barra lateral
3. Sign in
4. Expand "App Services"
5. Right-click en `jdimpresion-api` → "Download Publish Profile"

## Configurar el Secret en GitHub

Una vez que tengas el archivo `.PublishSettings`:

1. **Abre el archivo** con Notepad
2. **Copia TODO el contenido** (XML completo, desde `<?xml` hasta el final)
3. **Ve a GitHub:**
   ```
   https://github.com/andresD1az/backendJdImpresions/settings/secrets/actions
   ```
4. **New repository secret**
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Secret: Pega el contenido completo
5. **Add secret**

## Re-habilitar el Deployment

Después de configurar el secret:

1. Edita `.github/workflows/azure-deploy.yml`
2. Descomenta las líneas del trigger:
   ```yaml
   on:
     push:
       branches: [ main ]
     workflow_dispatch:
   ```
3. Commit y push

## Deployment Manual (Alternativa)

Si prefieres no usar GitHub Actions, puedes desplegar manualmente:

### Opción A: VS Code + Azure Extension
1. Instala extensión "Azure App Service"
2. Right-click en tu app → "Deploy to Web App"

### Opción B: Azure CLI
```powershell
# Build del proyecto
npm run build

# Crear ZIP
cd dist
Compress-Archive -Path * -DestinationPath ../deploy.zip

# Deploy
az webapp deployment source config-zip `
  --resource-group <TU_RESOURCE_GROUP> `
  --name jdimpresion-api `
  --src deploy.zip
```

## ¿Por qué está deshabilitado?

El workflow falla porque necesita el secret `AZURE_WEBAPP_PUBLISH_PROFILE` y no lo encuentra.

**Ventaja de deshabilitarlo:** 
- ✅ El CI deja de fallar constantemente
- ✅ El workflow de testing puede correr sin problemas
- ✅ Puedes habilitar deployment cuando estés listo

## Troubleshooting

### "No puedo descargar el publish profile"
- Usa el Método 2 (Azure CLI) como alternativa
- Verifica que tienes permisos de Contributor en el App Service
- Prueba en modo incógnito del navegador

### "No sé cuál es mi resource group"
1. Azure Portal → App Service `jdimpresion-api`
2. En "Overview" verás "Resource group"
3. Copia ese nombre

### "Prefiero deployment manual"
Está bien, usa las opciones de deployment manual arriba. GitHub Actions es opcional.

## Recomendación

**Por ahora:**
1. Deja el deployment deshabilitado
2. Enfócate en TestRail y las pruebas
3. Cuando quieras deployment automático, configura el secret

**El backend ya funciona en Azure**, solo necesitas actualizar el código cuando hagas cambios importantes.
