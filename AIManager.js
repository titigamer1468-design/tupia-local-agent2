// ============================================================================
// 🧠 AIManager.js - CEREBRO DE INTELIGENCIA ARTIFICIAL
// ============================================================================
//
// IMPORTANTE:
// Este archivo se ejecuta en el navegador.
// No debe contener API Keys.
//
// Las credenciales de OpenAI, Claude, Gemini, DeepSeek, Alibaba y Nvidia
// deben vivir exclusivamente en Cloudflare Worker Secrets.
//
// Endpoint esperado:
// POST /api/ai
//
// Body enviado:
//
// {
//   "activeModel": "openai",
//   "specificModel": "gpt-4o-mini",
//   "activePersona": "director",
//   "prompt": "...",
//   "history": [],
//   "images": []
// }
//
// Respuesta recomendada del Worker:
//
// {
//   "reply": "Respuesta de la IA"
// }
//
// o:
//
// {
//   "content": "Respuesta de la IA"
// }
//
// o, para el Director:
//
// {
//   "reply": "[{\"id\":0,\"texto_pantalla\":\"...\"}]",
//   "directorPlan": []
// }
// ============================================================================

const API_BASE = "https://tupia-local-agent1.titigamer1468.workers.dev";

const AI_ENDPOINT = `${API_BASE}/api/ai`;

const CAMERA_EFFECTS = [
  "zoom_in_3d",
  "zoom_out_3d",
  "pan_right",
  "pan_left",
  "wind_float",
  "wave_float"
];

// ============================================================================
// MODELOS DISPONIBLES
// ============================================================================
//
// No se incluyen API Keys aquí.
//
// Los modelos deben coincidir con los modelos que realmente acepte tu Worker.
// ============================================================================

export const MODEL_VERSIONS = {
  openai: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini"
    },
    {
      id: "gpt-4o",
      name: "GPT-4o"
    },
    {
      id: "gpt-4.1",
      name: "GPT-4.1"
    }
  ],

  claude: [
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude Sonnet 3.5"
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude Haiku 3.5"
    }
  ],

  gemini: [
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash"
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro"
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash"
    }
  ],

  deepseek: [
    {
      id: "deepseek-chat",
      name: "DeepSeek V3 Chat"
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek R1 Reasoner"
    }
  ],

  alibaba: [
    {
      id: "qwen-plus",
      name: "Qwen Plus"
    },
    {
      id: "qwen-max",
      name: "Qwen Max"
    }
  ],

  nvidia: [
    {
      id: "meta/llama3-70b-instruct",
      name: "Llama 3 70B"
    }
  ]
};

// ============================================================================
// PERSONAS
// ============================================================================

export const PERSONAS = {
  default:
    "Eres Tupia, un asistente de IA experto y amigable. Respondes de forma clara, directa y estructurada, ideal para leer en móvil.",

  plan:
    "Eres Tupia MODO PLAN. Eres un Estratega y Project Manager experto. No escribes código. Tu objetivo es desglosar ideas en planes de acción paso a paso, cronogramas, listas de requisitos, riesgos, recursos y objetivos. Estructuras todo con listas para máxima claridad.",

  think:
    "Eres Tupia MODO THINK. Eres un Arquitecto de Software y Diseñador de Prompts. Tu objetivo es tomar un Plan y pensar la arquitectura técnica. Desglosas el proyecto en: 1) Estructura de archivos, 2) Flujo de datos, 3) Componentes y responsabilidades, 4) APIs y contratos de datos, 5) Secuencia exacta de prompts superdetallados, 6) Riesgos técnicos y pruebas.",

  build:
    "Eres Tupia MODO BUILD. Eres un Desarrollador Full-Stack de élite. Escribes código listo para producción, limpio, seguro y optimizado. No das explicaciones largas ni saludos innecesarios. Entregas archivos completos cuando sea necesario. Si falta información crítica, indica claramente qué dato falta.",

  director: `
Eres Tupia MODO DIRECTOR DE CINE.

Recibirás una temática del usuario y debes crear un guion visual para un Short, Reel o TikTok.

DEBES DEVOLVER ÚNICA Y EXCLUSIVAMENTE UN ARRAY JSON VÁLIDO.
NO ESCRIBAS MARKDOWN.
NO USES BLOQUES \`\`\`.
NO ESCRIBAS EXPLICACIONES ANTES NI DESPUÉS DEL JSON.

El array debe contener al menos 3 escenas.

Cada escena debe tener exactamente esta estructura:

[
  {
    "id": 0,
    "texto_pantalla": "TÍTULO VIRAL",
    "efecto_camara": "zoom_in_3d",
    "duracion": 5
  }
]

Reglas:

- "id" debe comenzar en 0 y aumentar consecutivamente.
- "texto_pantalla" debe ser texto breve, potente y legible en móvil.
- "duracion" debe ser un número en segundos.
- "duracion" debe estar entre 2 y 12 segundos.
- "efecto_camara" solo puede usar uno de estos valores:
  "zoom_in_3d",
  "zoom_out_3d",
  "pan_right",
  "pan_left",
  "wind_float",
  "wave_float".
- No generes voz.
- No generes audio.
- No generes imágenes.
- Solo genera texto visual y movimiento de cámara.
`,

  youtube:
    "Eres Tupia MODO YOUTUBE. Eres experto en retención de audiencia, títulos, miniaturas y algoritmo de YouTube. Creas títulos virales, conceptos de miniatura, ganchos para los primeros 15 segundos, estructura del vídeo y llamadas a la acción.",

  infoproducto:
    "Eres Tupia MODO INFOPRODUCTO. Eres experto en marketing digital, creación de cursos online, ofertas, promesas de valor, embudos de venta y copywriting persuasivo."
};

// ============================================================================
// UTILIDADES
// ============================================================================

const isObject = (value) =>
  value !== null && typeof value === "object";

const cleanString = (value, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const getImageBase64 = (image) => {
  if (!image || typeof image.data !== "string") {
    return "";
  }

  if (image.data.includes(",")) {
    return image.data.split(",")[1];
  }

  return image.data;
};

const getImageMime = (image) =>
  image?.mime || image?.mime_type || "image/png";

const getErrorMessage = (data, status) => {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return (
    data?.error?.message ||
    data?.error ||
    data?.message ||
    data?.detalle ||
    `Error HTTP ${status}`
  );
};

const extractTextFromResponse = (data) => {
  if (typeof data === "string") {
    return data;
  }

  if (!isObject(data)) {
    return "";
  }

  if (typeof data.reply === "string") {
    return data.reply;
  }

  if (typeof data.uiReply === "string") {
    return data.uiReply;
  }

  if (typeof data.content === "string") {
    return data.content;
  }

  if (typeof data.text === "string") {
    return data.text;
  }

  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  if (Array.isArray(data.content)) {
    const text = data.content
      .filter((item) => item?.type === "text")
      .map((item) => item.text)
      .join("\n");

    if (text) {
      return text;
    }
  }

  if (Array.isArray(data.choices)) {
    const choice = data.choices[0];

    if (typeof choice?.message?.content === "string") {
      return choice.message.content;
    }

    if (Array.isArray(choice?.message?.content)) {
      return choice.message.content
        .filter((item) => item?.type === "text")
        .map((item) => item.text)
        .join("\n");
    }

    if (typeof choice?.text === "string") {
      return choice.text;
    }
  }

  if (Array.isArray(data.candidates)) {
    return (
      data.candidates[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("\n") || ""
    );
  }

  return "";
};

const parseJsonArrayFromText = (text) => {
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const directValue = JSON.parse(cleaned);

    if (Array.isArray(directValue)) {
      return directValue;
    }
  } catch {
    // Se intenta extraer el array más adelante.
  }

  const startIndex = cleaned.indexOf("[");
  const endIndex = cleaned.lastIndexOf("]");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const possibleJson = cleaned.slice(startIndex, endIndex + 1);

  try {
    const parsed = JSON.parse(possibleJson);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeDirectorPlan = (plan) => {
  if (!Array.isArray(plan)) {
    return null;
  }

  const normalized = plan
    .map((scene, index) => {
      if (!isObject(scene)) {
        return null;
      }

      const effect = CAMERA_EFFECTS.includes(scene.efecto_camara)
        ? scene.efecto_camara
        : "zoom_in_3d";

      const parsedDuration = Number(scene.duracion);

      const duration = Number.isFinite(parsedDuration)
        ? Math.min(Math.max(parsedDuration, 2), 12)
        : 5;

      return {
        id: index,
        texto_pantalla:
          cleanString(
            scene.texto_pantalla ||
              scene.texto ||
              scene.text ||
              `Escena ${index + 1}`
          ).slice(0, 180),

        efecto_camara: effect,
        duracion: duration
      };
    })
    .filter(Boolean);

  return normalized.length >= 3 ? normalized : null;
};

const createDirectorUiReply = (directorPlan) => {
  const scenes = directorPlan
    .map(
      (scene) =>
        `📽️ **Escena ${scene.id + 1} (${scene.duracion}s)**\n` +
        `*Texto en pantalla:* ${scene.texto_pantalla}\n` +
        `*Movimiento de cámara:* ${scene.efecto_camara}`
    )
    .join("\n\n");

  return (
    `🎬 **¡El guion y la dirección están listos!**\n\n` +
    `He configurado el Estudio de Video con ` +
    `${directorPlan.length} escenas.\n\n` +
    `${scenes}\n\n` +
    `👉 Ve a la pestaña **ESTUDIO**, sube tus imágenes, ` +
    `ajusta el formato y renderiza el vídeo.`
  );
};

// ============================================================================
// CONSULTA PRINCIPAL DE IA
// ============================================================================

export async function procesarConsultaIA({
  activeModel = "openai",
  specificModel = "",
  activePersona = "default",
  finalInput = "",
  history = [],
  images = [],
  currentKey = null
}) {
  const modelList = MODEL_VERSIONS[activeModel];

  if (!modelList) {
    throw new Error(`Proveedor de IA no soportado: ${activeModel}`);
  }

  const selectedModel =
    specificModel || modelList[0]?.id;

  if (!selectedModel) {
    throw new Error(`No hay un modelo configurado para ${activeModel}.`);
  }

  const normalizedInput = typeof finalInput === "string" ? finalInput.trim() : "";
  const normalizedImages = Array.isArray(images) ? images : [];

  if (!normalizedInput && normalizedImages.length === 0) {
    throw new Error("La consulta está vacía.");
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter((message) => message?.role && message?.content)
        .slice(-10)
        .map((message) => ({
          role:
            message.role === "assistant"
              ? "assistant"
              : "user",
          content: String(message.content)
        }))
    : [];

  const safeImages = normalizedImages
    .filter((image) => image?.data)
    .map((image) => ({
      name: image.name || "imagen",
      mime: getImageMime(image),
      data: getImageBase64(image)
    }));

  const systemInstruction =
    PERSONAS[activePersona] || PERSONAS.default;

  const payload = {
    activeModel,
    provider: activeModel,
    specificModel: selectedModel,
    model: selectedModel,
    activePersona,
    systemInstruction,
    prompt: normalizedInput,
    finalInput: normalizedInput,
    history: safeHistory,
    images: safeImages
  };

  // currentKey se mantiene en la firma por compatibilidad con versiones
  // antiguas, pero deliberadamente no se envía al navegador ni al Worker.
  void currentKey;

  let response;

  try {
    response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(
      `No se pudo conectar con el Worker de IA: ${
        error?.message || "Error de red"
      }`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  let data;

  try {
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch {
    throw new Error("El Worker devolvió una respuesta ilegible.");
  }

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, response.status)
    );
  }

  const botReply = extractTextFromResponse(data);

  if (!botReply.trim() && !data?.directorPlan) {
    throw new Error(
      "El Worker respondió correctamente, pero no devolvió contenido."
    );
  }

  let directorPlan = null;
  let uiReply = botReply;

  if (activePersona === "director") {
    const planFromWorker = normalizeDirectorPlan(
      data?.directorPlan
    );

    const planFromText = normalizeDirectorPlan(
      parseJsonArrayFromText(botReply)
    );

    directorPlan = planFromWorker || planFromText;

    if (directorPlan) {
      uiReply = createDirectorUiReply(directorPlan);
    } else {
      uiReply =
        `⚠️ **Aviso del Director**\n\n` +
        `La IA respondió, pero no devolvió un array JSON ` +
        `válido con al menos 3 escenas.\n\n` +
        `Respuesta recibida:\n${botReply || "Sin contenido"}`;
    }
  }

  return {
    uiReply,
    reply: uiReply,
    content: uiReply,
    directorPlan,
    rawReply: botReply,
    provider: activeModel,
    model: selectedModel
  };
}

// ============================================================================
// 🚀 PUENTE UNIVERSAL MODAL SERVERLESS
// ============================================================================
//
// Esta función se conserva por compatibilidad, pero Modal Serverless
// ahora debe ser llamado desde el Cloudflare Worker.
// ============================================================================

export async function conectarModalServerless(
  workflowJSON,
  webhookUrl
) {
  if (!webhookUrl) {
    throw new Error(
      "No hay URL de Webhook configurada."
    );
  }

  let response;

  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workflow: workflowJSON
      })
    });
  } catch (error) {
    throw new Error(
      `Fallo de conexión con Modal: ${
        error?.message || "Error de red"
      }`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  let data;

  try {
    data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    throw new Error(
      "Modal devolvió una respuesta ilegible."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Error ${response.status}: ${getErrorMessage(
        data,
        response.status
      )}`
    );
  }

  return data;
}

// ============================================================================
// 📸 MOTOR DE RESPALDO DE IMÁGENES
// ============================================================================
//
// Nota:
// Esta función usa un servicio externo desde el navegador.
// Puede fallar por CORS, límites o disponibilidad del proveedor.
// ============================================================================

export async function generarImagenIA(
  prompt,
  {
    width = 1920,
    height = 1080,
    seed = Math.floor(Math.random() * 1000000),
    model = "flux"
  } = {}
) {
  if (!prompt || !String(prompt).trim()) {
    throw new Error(
      "Debes proporcionar un prompt para generar la imagen."
    );
  }

  const url =
    `https://image.pollinations.ai/prompt/` +
    `${encodeURIComponent(String(prompt).trim())}` +
    `?width=${width}` +
    `&height=${height}` +
    `&seed=${seed}` +
    `&nologo=true` +
    `&model=${encodeURIComponent(model)}`;

  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Error de red al generar la imagen: ${
        error?.message || "Error desconocido"
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `[${response.status}] El servicio de imágenes no está disponible.`
    );
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",")
        ? result.split(",")[1]
        : result;

      if (!base64) {
        reject(
          new Error(
            "El servicio no devolvió una imagen válida."
          )
        );
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(
        new Error(
          "No se pudo convertir la imagen a Base64."
        )
      );
    };

    reader.readAsDataURL(blob);
  });
}
