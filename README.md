# Flyer Strategist — Vercel V3

Esta versión usa una función Vercel mínima y explícita:

`api/analyze.js`

La ruta pública debe ser:

`https://TU-PROYECTO.vercel.app/api/analyze`

## Prueba antes de usar el formulario

Después de desplegar, abre directamente:

`/api/analyze`

Debes ver JSON parecido a:

```json
{
  "ok": true,
  "route": "/api/analyze",
  "model": "gpt-6-luna",
  "message": "Flyer Strategist API funcionando"
}
```

Si eso aparece, el frontend ya puede hacer POST al mismo endpoint.

## Estructura exacta

```text
index.html
styles.css
app.js
package.json
README.md
api/
  analyze.js
```

NO debe existir:
- `vercel.json`
- `api/analyze.mjs`

## Variables de entorno
En Vercel → Settings → Environment Variables:

- `OPENAI_API_KEY` = tu clave
- opcional `OPENAI_MODEL` = `gpt-6-luna`

Luego Redeploy.

## Configuración del proyecto
- Root Directory: `./`
- Framework Preset: `Other`
- Build Command: vacío/automático
- Output Directory: vacío/automático
