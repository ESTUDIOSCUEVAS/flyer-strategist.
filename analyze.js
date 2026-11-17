const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

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

function responseText(data) {
  if (data.output_text) return data.output_text;
  const pieces = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (c.type === "output_text" && c.text) pieces.push(c.text);
    }
  }
  return pieces.join("\n");
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

async function callOpenAI(input, system) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: input }
      ]
    })
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(data?.error?.message || `OpenAI API error ${r.status}`);
  }
  return responseText(data);
}

export function GET() {
  return Response.json({
    ok: true,
    route: "/api/analyze",
    model: MODEL,
    message: "Flyer Strategist API funcionando"
  });
}

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Falta configurar OPENAI_API_KEY en Vercel." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const docs = body.documents || {};
    const context = clip(docs.context);
    const persona = clip(docs.persona);
    const insight = clip(docs.insight);

    if (body.mode === "chat") {
      const message = String(body.message || "").slice(0, 2500).trim();
      if (!message) {
        return Response.json({ error: "Mensaje vacío" }, { status: 400 });
      }

      const previousAnalysis = JSON.stringify(body.analysis || {}).slice(0, 18000);
      const input = `
DOCUMENTO CONTEXTO:
${context || "[No proporcionado]"}

DOCUMENTO BUYER PERSONA:
${persona || "[No proporcionado]"}

DOCUMENTO INSIGHT:
${insight || "[No proporcionado]"}

ANÁLISIS PREVIO:
${previousAnalysis}

PETICIÓN:
${message}
`;
      const reply = await callOpenAI(
        input,
        "Eres el mismo director creativo del análisis anterior. Responde en español, de forma concreta. Mantén fidelidad a los documentos y no inventes datos. Si propones un cambio, explica brevemente su consecuencia estratégica."
      );
      return Response.json({ reply });
    }

    if ((context + persona + insight).trim().length < 50) {
      return Response.json(
        { error: "No hay contenido suficiente para analizar." },
        { status: 400 }
      );
    }

    const extra = String(body.extra_instruction || "").slice(0, 1800);
    const input = `
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

    let raw = await callOpenAI(input, SYSTEM);
    let analysis;
    try {
      analysis = parseJson(raw);
    } catch {
      const repaired = await callOpenAI(
        raw,
        "Convierte el contenido proporcionado en JSON válido. No agregues información nueva. Devuelve únicamente JSON."
      );
      analysis = parseJson(repaired);
    }

    return Response.json({ analysis });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error?.message || "Error al analizar los documentos." },
      { status: 500 }
    );
  }
}
