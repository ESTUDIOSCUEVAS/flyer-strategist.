import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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
- El prompt final debe ser usable por un generador de imágenes.
- No incluyas promociones, precios, fechas o lugares que no estén en los documentos.
- Si hay información contradictoria, señálala en warnings.

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

function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function clip(value: unknown, max = 26000) {
  if (!value) return "";
  const text = String(value);
  return text.length <= max ? text : text.slice(0, max) + "\n[Texto recortado por longitud]";
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  const parts: string[] = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function parseJson(text: string) {
  const clean = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(clean);
}

async function callOpenAI(input: string, system: string) {
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
  return extractOutputText(data);
}

async function readBody(req: IncomingMessage) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 250000) throw new Error("Solicitud demasiado grande.");
  }
  return raw ? JSON.parse(raw) : {};
}

async function handleAnalyze(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      route: "/analyze",
      model: MODEL,
      message: "Flyer Strategist funcionando"
    });
  }

  if (req.method !== "POST") {
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

      const previous = JSON.stringify(body.analysis || {}).slice(0, 18000);
      const input = `
DOCUMENTO CONTEXTO:
${context || "[No proporcionado]"}

DOCUMENTO BUYER PERSONA:
${persona || "[No proporcionado]"}

DOCUMENTO INSIGHT:
${insight || "[No proporcionado]"}

ANÁLISIS PREVIO:
${previous}

PETICIÓN:
${message}
`;
      const reply = await callOpenAI(
        input,
        "Eres el mismo director creativo del análisis anterior. Responde en español, de forma concreta. Mantén fidelidad a los documentos y no inventes datos."
      );
      return sendJson(res, 200, { reply });
    }

    if ((context + persona + insight).trim().length < 50) {
      return sendJson(res, 400, { error: "No hay contenido suficiente para analizar." });
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

    const raw = await callOpenAI(input, SYSTEM);
    let analysis: any;

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
  } catch (error: any) {
    console.error(error);
    return sendJson(res, 500, {
      error: error?.message || "Error al analizar los documentos."
    });
  }
}

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

async function serveFile(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(__dirname, normalized.replace(/^[/\\]/, ""));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/analyze") return handleAnalyze(req, res);
  if (url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "flyer-strategist" });
  }

  return serveFile(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Flyer Strategist escuchando en ${PORT}`);
});
