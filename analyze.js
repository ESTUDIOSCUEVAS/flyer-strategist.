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
- No incluyas alcohol, promociones, precios, fechas, lugares u otros datos que no estén en los documentos.
- Si hay información contradictoria entre documentos, señala la contradicción en "warnings" y evita elegir arbitrariamente.

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

function clip(s, max=26000) {
  if (!s) return "";
  const text = String(s);
  return text.length <= max ? text : text.slice(0, max) + "\n[Texto recortado por longitud]";
}

function jsonFromText(text) {
  const clean = text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  return JSON.parse(clean);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({error:"Método no permitido"});
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({error:"Falta configurar OPENAI_API_KEY en el servidor."});

  try {
    const body = req.body || {};
    const docs = body.documents || {};
    const context = clip(docs.context);
    const persona = clip(docs.persona);
    const insight = clip(docs.insight);

    if (body.mode === "chat") {
      const analysis = JSON.stringify(body.analysis || {}).slice(0,18000);
      const message = String(body.message || "").slice(0,2500);
      if (!message.trim()) return res.status(400).json({error:"Mensaje vacío"});

      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-6.1-terra",
        input: [
          { role:"system", content:`Eres el mismo director creativo del análisis anterior. Responde en español, de forma concreta. Mantén fidelidad a los documentos y no inventes datos. Si el usuario pide un cambio, explica la consecuencia estratégica cuando sea relevante.` },
          { role:"user", content:`DOCUMENTO CONTEXTO:\n${context}\n\nDOCUMENTO BUYER PERSONA:\n${persona}\n\nDOCUMENTO INSIGHT:\n${insight}\n\nANÁLISIS PREVIO:\n${analysis}\n\nPETICIÓN:\n${message}` }
        ]
      });
      return res.status(200).json({reply: response.output_text});
    }

    const extra = String(body.extra_instruction || "").slice(0,1800);
    if ((context+persona+insight).trim().length < 50) return res.status(400).json({error:"No hay contenido suficiente para analizar."});

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
      model: process.env.OPENAI_MODEL || "gpt-6.1-terra",
      input: [
        { role:"system", content:SYSTEM },
        { role:"user", content:userInput }
      ]
    });

    let analysis;
    try {
      analysis = jsonFromText(response.output_text);
    } catch {
      // Un intento de reparación mediante una segunda respuesta, sin inventar contenido nuevo.
      const repair = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-6.1-terra",
        input: [
          { role:"system", content:"Convierte el contenido proporcionado en JSON válido. No agregues información nueva. Devuelve únicamente JSON." },
          { role:"user", content:response.output_text }
        ]
      });
      analysis = jsonFromText(repair.output_text);
    }

    return res.status(200).json({analysis});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err?.message || "Error al analizar los documentos."});
  }
}
