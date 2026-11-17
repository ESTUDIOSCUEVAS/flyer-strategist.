# Flyer Strategist — versión corregida para Vercel

Esta versión usa el despliegue **Zero Config** de Vercel.

## Estructura que debe verse en la raíz del repositorio

```text
index.html
styles.css
app.js
package.json
README.md
api/
  analyze.js
```

No necesitas `vercel.json`.

Vercel detecta automáticamente `api/analyze.js` como una Vercel Function
y la publica en:

`/api/analyze`

## Configuración

En Vercel:

1. Importa el repositorio desde GitHub.
2. Ve a **Settings → Environment Variables**.
3. Agrega:
   - `OPENAI_API_KEY` = tu clave de OpenAI
4. Opcional:
   - `OPENAI_MODEL` = `gpt-6.1-terra`
5. Haz **Redeploy**.

## Importante

Nunca subas `OPENAI_API_KEY` a GitHub ni la escribas dentro de `app.js`,
`index.html` o `api/analyze.js`.

## Si ya tienes el repositorio creado

Borra `vercel.json` del repositorio actual y asegúrate de que exista
`api/analyze.js` dentro de una carpeta llamada exactamente `api`.
Después haz un nuevo deploy.
