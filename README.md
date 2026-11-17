# Flyer Strategist — ROOT ONLY

Esta versión no usa carpeta `/api`.

## Estructura

Todos los archivos están en la raíz:

```text
Dockerfile
.dockerignore
index.html
styles.css
app.js
server.js
package.json
README.md
```

El mismo `server.js`:
- sirve el sitio web;
- responde `GET /analyze` para comprobar que funciona;
- responde `POST /analyze` para generar el análisis;
- responde `GET /health`.

## Vercel

Vercel detectará el `Dockerfile` de la raíz y desplegará el proyecto como una aplicación HTTP.

### Configuración
- Root Directory: `./`
- Framework Preset: `Other`
- No uses Build Command personalizado.
- No uses Output Directory personalizado.
- No debe existir `vercel.json`.
- No debe existir carpeta `api`.

### Variables de entorno
Agrega en Vercel:

`OPENAI_API_KEY` = tu clave

Opcional:

`OPENAI_MODEL` = `gpt-6-luna`

## Prueba

Después del deploy abre:

`https://TU-DOMINIO.vercel.app/analyze`

Debe responder:

```json
{
  "ok": true,
  "route": "/analyze",
  "model": "gpt-6-luna",
  "message": "Flyer Strategist funcionando"
}
```

También puedes probar:

`https://TU-DOMINIO.vercel.app/health`
