# Flyer Strategist — Marketing Lab

Bot de dirección creativa que convierte tres PDFs en una propuesta de flyer:
1. Contexto y objetivo
2. Buyer Persona
3. Insight / brief

## Por qué este proyecto no es solo GitHub Pages
GitHub Pages puede publicar HTML/CSS/JS, pero no debe contener tu `OPENAI_API_KEY`.
La clave debe vivir en un servidor. Este repositorio está preparado para **Vercel**, conectado a GitHub.

## Flujo
- El navegador extrae texto de los PDFs usando PDF.js.
- El texto se envía a `/api/analyze`.
- La función serverless usa la OpenAI Responses API.
- Devuelve diagnóstico, insight, PIENSA/SIENTA/HAGA, mensaje, 3 rutas creativas y un prompt de imagen.
- El usuario puede conversar con el director creativo para refinar la propuesta.

## Publicación recomendada

### 1. GitHub
Crea un repositorio, por ejemplo:
`flyer-strategist`

Sube:
- `index.html`
- `styles.css`
- `app.js`
- `api/analyze.js`
- `package.json`
- `vercel.json`
- `README.md`

### 2. Vercel
1. Entra a Vercel.
2. Importa el repositorio desde GitHub.
3. En Project Settings → Environment Variables agrega:
   - `OPENAI_API_KEY` = tu clave
   - opcional: `OPENAI_MODEL` = `gpt-6.1-terra`
4. Deploy.

No escribas la clave en `app.js`, `index.html` ni en GitHub.

## Notas
- Los PDFs generados por los sitios anteriores contienen texto extraíble y funcionan bien.
- Un PDF escaneado o compuesto únicamente por imágenes puede no producir texto con PDF.js. En ese caso, usa un PDF exportado desde los sitios o agrega OCR/backend multimodal en una versión posterior.
- El modelo por defecto es `gpt-6.1-terra`; puedes cambiarlo mediante la variable `OPENAI_MODEL`.
