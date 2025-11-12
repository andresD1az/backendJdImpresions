# 🚀 Cómo Activar Deployment Automático a Azure

Actualmente el deployment está configurado pero en modo MANUAL por seguridad.

## Estado Actual ✅

- ✅ Tests automáticos funcionando
- ✅ CI/CD pipeline completo
- ✅ Azure App Service creado
- ⚠️ Deployment: MANUAL (para evitar deployments accidentales)

## Para Activar Deployment Automático

### Opción 1: Auto-Deploy en Branch Develop (Staging)

Ya está configurado en `ci-cd-complete.yml`. Solo necesitas:

```bash
# 1. Crear branch develop
git checkout -b develop
git push origin develop

# 2. Ahora cada push a develop → auto-deploy a staging
```

El workflow ya tiene:
```yaml
deploy-staging:
  if: github.ref == 'refs/heads/develop'
  # Auto-deploy cuando pushes a develop
```

### Opción 2: Auto-Deploy en Main (Producción)

**ADVERTENCIA**: Esto deployará a producción en cada push a main.

Editar `.github/workflows/ci-cd-complete.yml`:

```yaml
# Buscar línea ~207
deploy-production:
  # CAMBIAR:
  if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'
  
  # POR:
  if: github.ref == 'refs/heads/main'
```

### Opción 3: Mantener Manual (Recomendado)

Para producción, es mejor mantener deployment manual con approval:

```bash
# En GitHub Actions UI:
1. Go to Actions tab
2. Select "CI/CD Complete Pipeline"  
3. Click "Run workflow"
4. Select branch: main
5. Requires manual approval
6. Deploy
```

## Recomendación 🎯

```
✅ Tests: Automático (cada push)
✅ CI: Automático (cada push)
✅ Staging: Automático (push a develop)
⚠️ Production: Manual con approval (seguridad)
```

Esta es la mejor práctica en DevOps profesional.

## URLs de tu App

- **Staging**: https://jdimpresion-api-staging.azurewebsites.net (si configuras)
- **Production**: https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net

## Verificar Deployment

```bash
# Health check
curl https://jdimpresion-api-bdara4cbg3dkf5f9.canadacentral-01.azurewebsites.net/health

# Should return:
{
  "status": "ok",
  "timestamp": "2025-01-11T...",
  "environment": "production"
}
```
