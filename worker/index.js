// ============================================================================
// ☁️ worker/index.js - ROUTER PRINCIPAL DE CLOUDFLARE WORKERS
// ============================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ========================================================================
    // 1. CONSULTAS DE INTELIGENCIA ARTIFICIAL (/api/ai)
    // ========================================================================
    if (url.pathname === "/api/ai" && request.method === "POST") {
      try {
        const body = await request.json();
        const provider = body.activeModel || body.provider || "openai";
        const model = body.specificModel || body.model;
        const prompt = body.prompt || body.finalInput || "";
        const history = Array.isArray(body.history) ? body.history : [];
        const systemInstruction = body.systemInstruction || "";

        const messages = [];
        if (systemInstruction) {
          messages.push({ role: "system", content: systemInstruction });
        }
        history.forEach((msg) => {
          if (msg?.role && msg?.content) {
            messages.push({ role: msg.role, content: String(msg.content) });
          }
        });
        if (prompt) {
          messages.push({ role: "user", content: prompt });
        }

        // --- DEEPSEEK ---
        if (provider === "deepseek") {
          const apiKey = env.DEEPSEEK_API_KEY;
          if (!apiKey) {
            return jsonResponse({ error: "Falta configurar DEEPSEEK_API_KEY en Cloudflare Secrets." }, 500);
          }

          const res = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model || "deepseek-v4-flash",
              messages,
              stream: false
            })
          });

          const data = await res.json();
          if (!res.ok) {
            return jsonResponse({ error: data?.error?.message || data?.error || `Error DeepSeek HTTP ${res.status}` }, res.status);
          }

          return jsonResponse({ reply: data?.choices?.[0]?.message?.content || "" });
        }

        // --- OPENAI ---
        if (provider === "openai") {
          const apiKey = env.OPENAI_API_KEY;
          if (!apiKey) {
            return jsonResponse({ error: "Falta configurar OPENAI_API_KEY en Cloudflare Secrets." }, 500);
          }

          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model || "gpt-5.6-luna",
              messages,
              stream: false
            })
          });

          const data = await res.json();
          if (!res.ok) {
            return jsonResponse({ error: data?.error?.message || data?.error || `Error OpenAI HTTP ${res.status}` }, res.status);
          }

          return jsonResponse({ reply: data?.choices?.[0]?.message?.content || "" });
        }

        // --- CLAUDE ---
        if (provider === "claude") {
          const apiKey = env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            return jsonResponse({ error: "Falta configurar ANTHROPIC_API_KEY en Cloudflare Secrets." }, 500);
          }

          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: model || "claude-3-5-sonnet-20241022",
              max_tokens: 4096,
              system: systemInstruction || undefined,
              messages: history.concat(prompt ? [{ role: "user", content: prompt }] : [])
            })
          });

          const data = await res.json();
          if (!res.ok) {
            return jsonResponse({ error: data?.error?.message || `Error Claude HTTP ${res.status}` }, res.status);
          }

          return jsonResponse({ reply: data?.content?.[0]?.text || "" });
        }

        // --- GEMINI ---
        if (provider === "gemini") {
          const apiKey = env.GEMINI_API_KEY;
          if (!apiKey) {
            return jsonResponse({ error: "Falta configurar GEMINI_API_KEY en Cloudflare Secrets." }, 500);
          }

          const targetModel = model || "gemini-2.0-flash";
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
              })
            }
          );

          const data = await res.json();
          if (!res.ok) {
            return jsonResponse({ error: data?.error?.message || `Error Gemini HTTP ${res.status}` }, res.status);
          }

          const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          return jsonResponse({ reply: replyText });
        }

        // --- ALIBABA ---
        if (provider === "alibaba") {
          const apiKey = env.ALIBABA_API_KEY;
          if (!apiKey) {
            return jsonResponse({ error: "Falta configurar ALIBABA_API_KEY en Cloudflare Secrets." }, 500);
          }

          const res = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({ model: model || "qwen-max", messages })
          });

          const data = await res.json();
          if (!res.ok) {
            return jsonResponse({ error: data?.error?.message || `Error Alibaba HTTP ${res.status}` }, res.status);
          }

          return jsonResponse({ reply: data?.choices?.[0]?.message?.content || "" });
        }

        // --- NVIDIA ---
        if (provider === "nvidia") {
          const apiKey = env.NVIDIA_API_KEY;
          if (!apiKey) {
            return jsonResponse({ error: "Falta configurar NVIDIA_API_KEY en Cloudflare Secrets." }, 500);
          }

          const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model || "meta/llama3-70b-instruct",
              messages,
              max_tokens: 1024
            })
          });

          const data = await res.json();
          if (!res.ok) {
            return jsonResponse({ error: data?.error?.message || `Error Nvidia HTTP ${res.status}` }, res.status);
          }

          return jsonResponse({ reply: data?.choices?.[0]?.message?.content || "" });
        }

        return jsonResponse({ error: `Proveedor no soportado: ${provider}` }, 400);
      } catch (err) {
        return jsonResponse({ error: err.message || "Error interno en Worker" }, 500);
      }
    }

    // ========================================================================
    // 2. ENRUTADOR DE SÚPER FÁBRICA (/api/factory)
    // ========================================================================
    if (url.pathname === "/api/factory" && request.method === "POST") {
      try {
        const body = await request.json();
        const { factoryMode, workflow, imagen_base64, itemIndex } = body;
        const promptText = typeof workflow === "string" ? workflow : JSON.stringify(workflow);

        // 1. PRIORIDAD TOTAL: Si tienes MODAL_WEBHOOK_URL o VPS_URL configurado
        const dedicatedServerUrl = env.MODAL_WEBHOOK_URL || env.VPS_URL;

        if (dedicatedServerUrl) {
          // Si es VPS agregamos ruta, si es Modal llamamos directo a la URL base
          const targetUrl = dedicatedServerUrl.includes("modal.run")
            ? dedicatedServerUrl
            : `${dedicatedServerUrl.replace(/\/$/, "")}/api/factory`;

          const res = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              factoryMode,
              prompt: promptText,
              workflow,
              imagen_base64: imagen_base64 || null,
              itemIndex: itemIndex || 0
            })
          });

          const data = await res.json();
          return jsonResponse(data, res.status);
        }

        // 2. FALLBACK NUBE (Solo si NO hay Modal ni VPS configurado)
        if (factoryMode === "video") {
          const seed = Math.floor(Math.random() * 1000000);
          const videoUrl = `https://video.pollinations.ai/prompt/${encodeURIComponent(promptText)}?seed=${seed}&width=720&height=1280&model=wan`;

          const videoRes = await fetch(videoUrl);
          if (!videoRes.ok) {
            throw new Error(`El motor de video en la nube devolvió HTTP ${videoRes.status}`);
          }

          const arrayBuffer = await videoRes.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Video = btoa(binary);

          return jsonResponse({
            archivo_base64: base64Video,
            extension: "mp4",
            status: "success"
          });
        }

        // Fallback Imagen (Flux HD)
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=1080&height=1920&seed=${seed}&nologo=true&model=flux`;

        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
          throw new Error(`El motor de imagen falló con HTTP ${imageRes.status}`);
        }

        const arrayBuffer = await imageRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Image = btoa(binary);

        return jsonResponse({
          archivo_base64: base64Image,
          extension: "png",
          status: "success"
        });

      } catch (err) {
        return jsonResponse({ error: `Fallo en Fábrica: ${err.message}` }, 500);
      }
    }

    // ========================================================================
    // 3. ENRUTADOR DE RENDERIZADO (/api/render)
    // ========================================================================
    if (url.pathname === "/api/render" && request.method === "POST") {
      try {
        const body = await request.json();
        const vpsUrl = env.VPS_URL;

        if (!vpsUrl) {
          return jsonResponse({ error: "Falta configurar VPS_URL en Cloudflare para renders remotos." }, 500);
        }

        const response = await fetch(`${vpsUrl}/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        return jsonResponse(data, response.status);
      } catch (err) {
        return jsonResponse({ error: `Fallo en Render: ${err.message}` }, 500);
      }
    }

    // ========================================================================
    // 4. ARCHIVOS ESTÁTICOS
    // ========================================================================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
