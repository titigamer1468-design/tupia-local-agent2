// =================================================================
// 🧠 AIManager.js - CEREBRO DE INTELIGENCIA ARTIFICIAL
// =================================================================

export const MODEL_VERSIONS = {
  openai: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }, { id: 'gpt-4o', name: 'GPT-4o (Mejor)' }],
  claude: [{ id: 'claude-3-5-sonnet-20241022', name: 'Sonnet 3.5' }, { id: 'claude-3-5-haiku-20241022', name: 'Haiku 3.5' }],
  gemini: [{ id: 'gemini-1.5-flash', name: '1.5 Flash' }, { id: 'gemini-1.5-pro', name: '1.5 Pro' }],
  deepseek: [{ id: 'deepseek-chat', name: 'V3 Chat' }, { id: 'deepseek-reasoner', name: 'R1 Reasoner' }],
  alibaba: [{ id: 'qwen-plus', name: 'Qwen Plus' }, { id: 'qwen-max', name: 'Qwen Max' }],
  nvidia: [{ id: 'meta/llama3-70b-instruct', name: 'Llama 3 70B' }]
};

export const PERSONAS = {
  default: "Eres Tupia, un asistente de IA experto y amigable. Respondes de forma clara, directa y estructurada, ideal para leer en móvil.",
  plan: "Eres Tupia MODO PLAN. Eres un Estratega y Project Manager experto. No escribes código. Tu objetivo es desglosar ideas en planes de acción paso a paso, cronogramas, listas de requisitos y definir objetivos. Estructuras todo con listas para máxima claridad.",
  think: "Eres Tupia MODO THINK. Eres un Arquitecto de Software y Diseñador de Prompts (Prompt Engineer). Tu objetivo es tomar un 'Plan' y PENSAR la arquitectura técnica. Desglosas el proyecto en: 1) Estructura de archivos, 2) Flujo de datos, y 3) Secuencia exacta de PROMPTS super detallados.",
  build: "Eres Tupia MODO BUILD. Eres un Desarrollador Full-Stack de élite. Escribes código listo para producción, limpio y optimizado. No das explicaciones largas ni saludos. Te limitas a entregar el bloque de código perfecto.",
  director: `Eres Tupia MODO DIRECTOR DE CINE. Recibirás una temática del usuario. Tu trabajo es escribir un guion para un Short/Reel impactante.
⚠️ DEBES DEVOLVER ÚNICA Y EXCLUSIVAMENTE UN ARRAY JSON VÁLIDO. SIN TEXTO ANTES NI DESPUÉS. ⚠️
El JSON debe tener esta estructura exacta para al menos 3 escenas (pueden ser más si la historia lo requiere):
[
  {
    "id": 0,
    "texto_pantalla": "TÍTULO VIRAL",
    "efecto_camara": "zoom_in_3d",
    "duracion": 5
  },
  {
    "id": 1,
    "texto_pantalla": "EL SECRETO",
    "efecto_camara": "pan_right",
    "duracion": 5
  }
]
Efectos de cámara permitidos: "zoom_in_3d", "zoom_out_3d", "pan_right", "pan_left", "wind_float", "wave_float". No generes voz, solo el texto visual y el movimiento.`,
  youtube: "Eres Tupia MODO YOUTUBE. Eres un experto en retención de audiencia y el algoritmo de YouTube. Creas Títulos Virales, Miniaturas y Ganchos (Hooks) irresistibles para los primeros 15 segundos.",
  infoproducto: "Eres Tupia MODO INFOPRODUCTO. Eres un experto en Marketing Digital y creación de Cursos Online. Diseñas ofertas irresistibles, promesas de valor y copy persuasivo."
};

export async function procesarConsultaIA({
  activeModel,
  specificModel,
  activePersona,
  finalInput,
  history,
  images,
  currentKey
}) {
  const systemInstruction = PERSONAS[activePersona] || PERSONAS.default;
  let botReply = "";

  if (activeModel === 'gemini') {
    const geminiHistory = history.map(m => ({ 
      role: m.role === 'user' ? 'user' : 'model', 
      parts: [{ text: m.content }] 
    }));
    
    const currentParts = [{ text: finalInput }];
    images.forEach(img => {
      currentParts.push({ 
        inline_data: { mime_type: img.mime, data: img.data.split(',')[1] } 
      });
    });
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${specificModel}:generateContent?key=${currentKey}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        system_instruction: { parts: [{ text: systemInstruction }] }, 
        contents: [...geminiHistory, { role: 'user', parts: currentParts }] 
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    botReply = data.candidates[0].content.parts[0].text;
  }
  
  else if (activeModel === 'claude') {
    const claudeHistory = history.map(m => ({ role: m.role, content: m.content }));
    const currentContent = [{ type: 'text', text: finalInput }];
    
    images.forEach(img => {
      currentContent.push({ 
        type: 'image', 
        source: { type: 'base64', media_type: img.mime, data: img.data.split(',')[1] } 
      });
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
        'x-api-key': currentKey, 
        'anthropic-version': '2023-06-01', 
        'anthropic-dangerous-direct-browser-access': 'true' 
      },
      body: JSON.stringify({ 
        model: specificModel, 
        max_tokens: 4096, 
        system: systemInstruction, 
        messages: [...claudeHistory, { role: 'user', content: currentContent }] 
      })
    });
    const data = await res.json();
    if (data.type === 'error') throw new Error(data.error.message);
    botReply = data.content[0].text;
  }
  
  else {
    let endpoint = '';
    if (activeModel === 'openai') endpoint = 'https://api.openai.com/v1/chat/completions';
    else if (activeModel === 'deepseek') endpoint = 'https://api.deepseek.com/chat/completions';
    else if (activeModel === 'alibaba') endpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
    else if (activeModel === 'nvidia') endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';

    let currentContent = finalInput;
    if (activeModel === 'openai' && images.length > 0) {
      currentContent = [{ type: 'text', text: finalInput }];
      images.forEach(img => currentContent.push({ type: 'image_url', image_url: { url: img.data } }));
    }
    
    const standardHistory = history.map(m => ({ role: m.role, content: m.content }));

    const res = await fetch(endpoint, {
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${currentKey}` 
      },
      body: JSON.stringify({ 
        model: specificModel, 
        messages: [{ role: 'system', content: systemInstruction }, ...standardHistory, { role: 'user', content: currentContent }] 
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    botReply = data.choices[0].message.content;
  }

  let directorPlan = null;
  let uiReply = botReply;

  if (activePersona === 'director') {
    try {
      const jsonMatch = botReply.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        directorPlan = JSON.parse(jsonMatch[0]);
        uiReply = `🎬 **¡El Guion y la Dirección están Listos!**\nHe configurado el Estudio de Video con ${directorPlan.length} escenas.\n\n` +
                   directorPlan.map(p => `📽️ **Escena ${p.id + 1} (${p.duracion}s)**\n*Texto en Pantalla:* ${p.texto_pantalla}\n*Movimiento de Cámara:* ${p.efecto_camara}`).join('\n\n') +
                   `\n\n👉 ¡Ve a la pestaña ESTUDIO, ajusta los colores de tu marca, sube tus fotos y dale a Compilar Superproducción!`;
      } else {
        throw new Error("No se detectó un JSON válido en la respuesta de la IA.");
      }
    } catch (e) {
      console.error("Fallo parseando el Plan del Director:", e);
      uiReply = `⚠️ **Aviso del Director:**\nHubo un problema generando el formato matemático del video. Por favor, intenta de nuevo o cambia a OpenAI.\n\nRespuesta original:\n${botReply}`;
    }
  }

  return { uiReply, directorPlan };
}

// ---------------------------------------------------------
// 🎨 MOTOR DE IMAGEN 3 (CON RADAR DINÁMICO)
// ---------------------------------------------------------
export async function generarImagenGoogle(prompt, apiKey) {
  let modelName = "";
  let methodName = "predict";
  
  // 1. RADAR: Preguntamos a Google qué modelos existen para esta API Key
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      // Buscamos cualquier modelo de imagen (imagen-3.0-generate-001, 002, etc)
      const imagenModel = data.models?.find(m => m.name.includes("imagen"));
      if (imagenModel) {
        modelName = imagenModel.name; 
        if (imagenModel.supportedGenerationMethods) {
          methodName = imagenModel.supportedGenerationMethods[0];
        }
      }
    }
  } catch (e) {
    console.warn("Radar falló, usando versión base.");
  }

  // Si el radar no encuentra nada, forzamos el oficial estándar
  if (!modelName) {
    modelName = "models/imagen-3.0-generate-001";
  }

  // 2. CONSTRUIR URL EXACTA SEGÚN LO QUE RESPONDIÓ GOOGLE
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:${methodName}?key=${apiKey}`;
  
  // 3. ENVIAR LA PETICIÓN
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: "16:9" }
      })
    });
  } catch (e) {
    throw new Error(`Fallo de red: ${e.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error(`Google devolvió una respuesta inválida (Status ${response.status})`);
  }

  if (!response.ok) {
    if (response.status === 404) {
       throw new Error(`[404] TU API KEY NO TIENE ACCESO: Tu cuenta de Google AI Studio aún no tiene habilitado Imagen 3. Necesitas habilitarlo o usar una API Key con permisos.`);
    }
    const errorMsg = data?.error?.message || response.statusText;
    throw new Error(`[${response.status}] ${errorMsg}`);
  }
  
  if (data.error) throw new Error(data.error.message);
  
  let base64Image = null;
  // Google a veces devuelve "predictions" y a veces "generatedImages", atajamos ambas
  if (data.predictions && data.predictions.length > 0) {
     base64Image = data.predictions[0].bytesBase64Encoded;
  } else if (data.generatedImages && data.generatedImages.length > 0) {
     base64Image = data.generatedImages[0].image.imageBytes; 
  }

  if (!base64Image) {
    throw new Error("CENSURADO_POR_GOOGLE: El prompt activó los filtros de seguridad (Violencia, NSFW, Marcas, etc).");
  }

  return base64Image;
}
