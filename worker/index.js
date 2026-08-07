const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...JSON_HEADERS,
        ...extraHeaders
      }
    }
  );
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function responseWithCors(response, request) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(
    corsHeaders(request)
  )) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error(
      "El cuerpo de la petición debe ser JSON válido."
    );
  }
}

function normalizeMessages(body) {
  if (Array.isArray(body?.messages)) {
    return body.messages;
  }

  if (typeof body?.prompt === "string") {
    return [
      {
        role: "user",
        content: body.prompt
      }
    ];
  }

  throw new Error(
    "La petición debe incluir 'prompt' o 'messages'."
  );
}

async function handleHealth() {
  return json({
    ok: true,
    service: "tupia-local-agent",
    runtime: "cloudflare-workers",
    timestamp: new Date().toISOString()
  });
}

async function handleAI(request, env) {
  const body = await readJson(request);
  const messages = normalizeMessages(body);

  const model =
    body.model ||
    env.OPENAI_MODEL ||
    "@cf/meta/llama-3.1-8b-instruct";

  /*
   * Opción 1: Cloudflare Workers AI.
   *
   * Para usarla, configura un binding llamado AI en Cloudflare.
   */
  if (env.AI) {
    const prompt = messages
      .map((message) => {
        return `${message.role}: ${message.content}`;
      })
      .join("\n");

    const resultado = await env.AI.run(model, {
      prompt
    });

    const texto =
      resultado?.response ||
      resultado?.result?.response ||
      JSON.stringify(resultado);

    return json({
      ok: true,
      provider: "cloudflare-workers-ai",
      model,
      text: texto,
      response: texto
    });
  }

  /*
   * Opción 2: API compatible con OpenAI.
   *
   * Variables necesarias:
   * OPENAI_API_KEY
   * OPENAI_MODEL, opcional
   * OPENAI_BASE_URL, opcional
   */
  if (!env.OPENAI_API_KEY) {
    return json(
      {
        ok: false,
        error:
          "No hay proveedor de IA configurado. " +
          "Configura el binding AI o OPENAI_API_KEY."
      },
      503
    );
  }

  const baseUrl =
    env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1";

  const endpoint =
    `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const respuesta = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature:
        typeof body.temperature === "number"
          ? body.temperature
          : 0.2,
      max_tokens:
        typeof body.max_tokens === "number"
          ? body.max_tokens
          : undefined
    })
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    return json(
      {
        ok: false,
        error:
          datos?.error?.message ||
          "El proveedor de IA devolvió un error.",
        providerResponse: datos
      },
      respuesta.status
    );
  }

  const texto =
    datos?.choices?.[0]?.message?.content || "";

  return json({
    ok: true,
    provider: "openai-compatible",
    model,
    text: texto,
    response: texto,
    usage: datos.usage || null
  });
}

async function handleFactory(request) {
  const body = await readJson(request);

  return json({
    ok: true,
    type: "factory",
    received: body,
    message:
      "Solicitud de fábrica recibida correctamente."
  });
}

async function handleRender(request) {
  const body = await readJson(request);

  return json({
    ok: true,
    type: "render",
    status: "queued",
    received: body,
    message:
      "Solicitud de render recibida. " +
      "El procesamiento local debe realizarse en el navegador."
  });
}

async function handleApi(request, env, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    return handleHealth();
  }

  if (request.method !== "POST") {
    return json(
      {
        ok: false,
        error: "Método no permitido."
      },
      405,
      {
        Allow: "GET, POST, OPTIONS"
      }
    );
  }

  if (pathname === "/api/ai") {
    return handleAI(request, env);
  }

  if (pathname === "/api/factory") {
    return handleFactory(request);
  }

  if (pathname === "/api/render") {
    return handleRender(request);
  }

  return json(
    {
      ok: false,
      error: "Ruta API no encontrada."
    },
    404
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    try {
      if (url.pathname.startsWith("/api/")) {
        const respuesta = await handleApi(
          request,
          env,
          url.pathname
        );

        return responseWithCors(
          respuesta,
          request
        );
      }

      if (!env.ASSETS) {
        return new Response(
          "Binding ASSETS no configurado.",
          {
            status: 500,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);

      return responseWithCors(
        json(
          {
            ok: false,
            error:
              error?.message ||
              "Error interno del Worker."
          },
          500
        ),
        request
      );
    }
  }
};