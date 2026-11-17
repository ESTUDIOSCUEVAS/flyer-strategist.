# Flyer Strategist — Root V4

Esta versión mantiene TODO en la raíz y usa `server.ts`.

Vercel detecta automáticamente `server.ts` en la raíz como una aplicación Node.

## Archivos

```text
index.html
styles.css
app.js
server.ts
package.json
README.md
```

NO uses:
- carpeta api
- vercel.json
- Dockerfile
- server.js

## Vercel

- Root Directory: `./`
- Framework Preset: Other
- Build Command: vacío
- Output Directory: vacío

Variables:

- OPENAI_API_KEY = tu clave
- opcional OPENAI_MODEL = gpt-6-luna

## Prueba

Después del deploy:

`/health`

debe devolver:

`{"ok":true,"service":"flyer-strategist"}`

Después:

`/analyze`

debe devolver:

`{"ok":true,"route":"/analyze",...}`

Si ambas rutas funcionan, el botón del frontend ya puede analizar los PDFs.
