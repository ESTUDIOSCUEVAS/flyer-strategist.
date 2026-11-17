import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 3000);
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

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function clip(s, max = 26000) {
  if (!s) return "";
  const text = String(s);
  return text.length <= max ? text : text.slice(0, max) + "\n[Texto recortado por longitud]";
}

function responseText(data) {
  if (data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Falta configurar OPENAI_API_KEY en Vercel.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
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

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI API error ${response.status}`);
  }
  return responseText(data);
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200_000) throw new Error("Solicitud demasiado grande.");
  }
  return raw ? JSON.parse(raw) : {};
}

async function handleAnalyze(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      route: "/analyze",
      model: MODEL,
      message: "Flyer Strategist funcionando"
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  try {
    const body = await readBody(req);
    const docs = body.documents || {};
    const context = clip(docs.context);
    const persona = clip(docs.persona);
    const insight = clip(docs.insight);

    if (body.mode === "chat") {
      const message = String(body.message || "").slice(0, 2500).trim();
      if (!message) return sendJson(res, 400, { error: "Mensaje vacío" });

      const previousAnalysis = JSON.stringify(body.analysis || {}).slice(0, 18000);
      const prompt = `
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
        prompt,
        "Eres el mismo director creativo del análisis anterior. Responde en español, de forma concreta. Mantén fidelidad a los documentos y no inventes datos. Si propones un cambio, explica brevemente su consecuencia estratégica."
      );
      return sendJson(res, 200, { reply });
    }

    if ((context + persona + insight).trim().length < 50) {
      return sendJson(res, 400, { error: "No hay contenido suficiente para analizar." });
    }

    const extra = String(body.extra_instruction || "").slice(0, 1800);
    const prompt = `
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

    let raw = await callOpenAI(prompt, SYSTEM);
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

    return sendJson(res, 200, { analysis });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      error: error?.message || "Error al analizar los documentos."
    });
  }
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(__dirname, normalized.replace(/^[/\\]/, ""));

  // Only allow files inside project root.
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
  } catch {
    // SPA-like fallback for unknown browser paths.
    try {
      const data = await readFile(join(__dirname, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/analyze") {
    return handleAnalyze(req, res);
  }

  if (url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "flyer-strategist" });
  }

  return serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Flyer Strategist escuchando en puerto ${PORT}`);
});
