# Flyer Strategist — Vercel v2

Versión preparada para el runtime actual de Vercel.

## Estructura exacta

```text
index.html
styles.css
app.js
package.json
README.md
api/
  analyze.mjs
```

NO debe existir `vercel.json`.

## Vercel

- Root Directory: `./`
- Application Preset: `Other`
- Build Command: dejar vacío / automático
- Output Directory: dejar vacío / automático

### Environment Variables

Obligatoria:

`OPENAI_API_KEY` = tu clave

Opcional:

`OPENAI_MODEL` = `gpt-6-luna`

Si prefieres mayor calidad puedes cambiar la variable por otro modelo disponible en tu cuenta.

## Importante al actualizar un repositorio existente

Subir estos archivos no elimina archivos viejos automáticamente.
Borra manualmente del repositorio:

- `vercel.json`
- `api/analyze.js`

y confirma que exista:

- `api/analyze.mjs`

Después haz un commit y vuelve a desplegar.
