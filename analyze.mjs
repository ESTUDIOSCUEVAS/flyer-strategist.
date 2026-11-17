import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `
Eres un director creativo senior especializado en marketing, comportamiento del consumidor y diseño de flyers.
Tu función NO es hacer un diseño bonito por intuición. Debes convertir investigación en decisiones de comunicación.

Recibirás hasta tres documentos convertidos a texto:
1) análisis de contexto y objetivos,
2) Buyer Persona,
3) insight / brief previo.

REGLAS:
- Usa los documentos como fuente principal.
- No inventes hechos que no estén en los documentos.
- Si algo no está sustentado, trátalo como hipótesis o supuesto.
- Distingue el producto aparente de lo que la persona realmente puede estar buscando.
- La propuesta debe conectar contexto + Buyer Persona + tensión + objetivo.
- No satures el flyer: prioriza una idea central.
- Cada ruta creativa debe ser suficientemente diferente de las otras.
- Explica brevemente por qué cada ruta conecta con la investigación.
- El prompt final debe ser usable por un generador de imágenes y describir composición, jerarquía, emoción, estilo, información y CTA.
- No incluyas promociones, precios, fechas, lugares u otros datos que no estén en los documentos.
- Si hay información contradictoria entre documentos, señálala en "warnings" y evita elegir arbitrariamente.

Devuelve JSON válido, sin markdown ni texto fuera del JSON, con esta estructura exacta:
{
  "apparent_product": "...",
  "real_job": "...",
  "main_tension": "...",
  "primary_emotion": "...",
  "creative_insight": "...",
  "insight_rationale": "...",
  "think": "...",
  "feel": "...",
  "do": "...",
  "central_message": "...",
  "promise": "...",
  "warnings": ["..."],
  "routes": [
    {
      "name": "...",
      "headline": "...",
      "subheadline": "...",
      "visual_direction": "...",
      "hierarchy": ["...", "...", "..."],
      "cta": "...",
      "why": "..."
    }
  ],
  "image_prompt": "..."
}
`;

function clip(s, max = 26000) {
  if (!s) return "";
  const text = String(s);
  return text.length <= max ? text : text.slice(0, max) + "\n[Texto recortado por longitud]";
}

function parseJson(text) {
  const clean = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(clean);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return json({ error: "Método no permitido" }, 405);
    }
    if (!process.env.OPENAI_API_KEY) {
      return json({ error: "Falta configurar OPENAI_API_KEY en Vercel." }, 500);
    }

    try {
      const body = await request.json();
      const docs = body.documents || {};
      const context = clip(docs.context);
      const persona = clip(docs.persona);
      const insight = clip(docs.insight);
      const model = process.env.OPENAI_MODEL || "gpt-6-luna";

      if (body.mode === "chat") {
        const message = String(body.message || "").slice(0, 2500).trim();
        if (!message) return json({ error: "Mensaje vacío" }, 400);

        const previousAnalysis = JSON.stringify(body.analysis || {}).slice(0, 18000);

        const response = await client.responses.create({
          model,
          input: [
            {
              role: "system",
              content:
                "Eres el mismo director creativo del análisis anterior. Responde en español, de forma concreta. Mantén fidelidad a los documentos y no inventes datos. Si propones un cambio, explica brevemente su consecuencia estratégica."
            },
            {
              role: "user",
              content:
`DOCUMENTO CONTEXTO:
${context || "[No proporcionado]"}

DOCUMENTO BUYER PERSONA:
${persona || "[No proporcionado]"}

DOCUMENTO INSIGHT:
${insight || "[No proporcionado]"}

ANÁLISIS PREVIO:
${previousAnalysis}

PETICIÓN:
${message}`
            }
          ]
        });

        return json({ reply: response.output_text || "No se generó respuesta." });
      }

      if ((context + persona + insight).trim().length < 50) {
        return json({ error: "No hay contenido suficiente para analizar." }, 400);
      }

      const extra = String(body.extra_instruction || "").slice(0, 1800);

      const userInput = `
DOCUMENTO 1 · CONTEXTO Y OBJETIVO
${context || "[No proporcionado]"}

DOCUMENTO 2 · BUYER PERSONA
${persona || "[No proporcionado]"}

DOCUMENTO 3 · INSIGHT / BRIEF
${insight || "[No proporcionado]"}

INSTRUCCIÓN ADICIONAL DEL USUARIO
${extra || "[Ninguna]"}

Construye una dirección creativa para el flyer siguiendo estrictamente las reglas y el esquema JSON.
`;

      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userInput }
        ]
      });

      let analysis;
      try {
        analysis = parseJson(response.output_text);
      } catch {
        const repair = await client.responses.create({
          model,
          input: [
            {
              role: "system",
              content: "Convierte el contenido proporcionado en JSON válido. No agregues información nueva. Devuelve únicamente JSON."
            },
            { role: "user", content: response.output_text || "" }
          ]
        });
        analysis = parseJson(repair.output_text);
      }

      return json({ analysis });
    } catch (error) {
      console.error(error);
      return json(
        { error: error?.message || "Error al analizar los documentos." },
        500
      );
    }
  }
};
