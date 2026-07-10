import React, { useState, useRef, useEffect } from "react";
// 🔥 IMPORTACIÓN NATIVA: Vite empaquetará los Workers en tu dominio 🔥
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const MODEL_VERSIONS = {
  openai: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }, { id: 'gpt-4o', name: 'GPT-4o (Mejor)' }],
  claude: [{ id: 'claude-3-5-sonnet-20241022', name: 'Sonnet 3.5' }, { id: 'claude-3-5-haiku-20241022', name: 'Haiku 3.5' }],
  gemini: [{ id: 'gemini-1.5-flash', name: '1.5 Flash' }, { id: 'gemini-1.5-pro', name: '1.5 Pro' }],
  deepseek: [{ id: 'deepseek-chat', name: 'V3 Chat' }, { id: 'deepseek-reasoner', name: 'R1 Reasoner' }],
  alibaba: [{ id: 'qwen-plus', name: 'Qwen Plus' }, { id: 'qwen-max', name: 'Qwen Max' }],
  nvidia: [{ id: 'meta/llama3-70b-instruct', name: 'Llama 3 70B' }]
};

const PERSONAS = {
  default: "Eres Tupia, un asistente de IA experto y amigable. Respondes de forma clara, directa y estructurada.",
  plan: "Eres Tupia MODO PLAN. Eres un Estratega y Project Manager experto. No escribes código. Tu objetivo es desglosar ideas en planes de acción paso a paso, cronogramas, listas de requisitos y definir objetivos. Estructuras todo con listas para máxima claridad.",
  think: "Eres Tupia MODO THINK. Eres un Arquitecto de Software y Diseñador de Prompts (Prompt Engineer). Tu objetivo es tomar un 'Plan' y PENSAR la arquitectura técnica. Desglosas el proyecto en: 1) Estructura de archivos, 2) Flujo de datos, y 3) Escribes la secuencia exacta de PROMPTS super detallados que el usuario deberá copiar y pegar en el 'Modo Build' para que la IA genere el código sin errores. Eres el puente entre la idea y la programación.",
  build: "Eres Tupia MODO BUILD. Eres un Desarrollador Full-Stack de élite. Escribes código listo para producción, limpio y optimizado. No das explicaciones largas ni saludos. Te limitas a entregar el bloque de código perfecto solicitado y una breve línea de cómo usarlo.",
  director: "Eres Tupia MODO DIRECTOR DE CINE. Tu trabajo es analizar la emoción o temática que pide el usuario y tomar DECISIONES MATEMÁTICAS ÓPTIMAS de animación para un motor de video. Debes decidir el tiempo por foto, el factor de zoom y las coordenadas de paneo. ESTRICTAMENTE PROHIBIDO usar markdown o texto de relleno. DEBES devolver UNICAMENTE un objeto JSON válido con esta estructura exacta: { \"emocion_detectada\": \"str\", \"duracion_clip_segundos\": float, \"zoom_inicial\": float (ej. 1.0), \"zoom_final\": float (ej. 1.5), \"matematica_zoompan_x\": \"str (ej. 'iw/2-(iw/zoom/2)')\", \"matematica_zoompan_y\": \"str\", \"explicacion_decisiones\": \"str\" }",
  youtube: "Eres Tupia MODO YOUTUBE. Eres un experto en retención de audiencia y el algoritmo de YouTube. Creas Títulos Virales y Ganchos (Hooks) irresistibles para los primeros 15 segundos.",
  infoproducto: "Eres Tupia MODO INFOPRODUCTO. Eres un experto en Marketing Digital y creación de Cursos Online. Diseñas ofertas irresistibles y copy persuasivo."
};

// 🔥 NORMALIZADOR UNIVERSAL DE IMÁGENES 🔥
const normalizeImageToJPG = (file) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, 'image/jpeg', 0.95);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Error al normalizar la imagen " + file.name));
    };
    img.src = url;
  });
};

const CodeBlock = ({ lang, code }) => {
  const handleCopy = () => navigator.clipboard.writeText(code.trim());
  const handleDownload = () => {
    const blob = new Blob([code.trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codigo.${lang || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-4 bg-gray-950 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800 text-xs font-bold text-gray-300 border-b border-gray-700">
        <span className="uppercase">{lang || 'TEXTO'}</span>
        <div className="flex gap-3">
          <button onClick={handleCopy} className="hover:text-white transition-colors flex items-center gap-1"><span>📋</span> Copiar Código</button>
          <button onClick={handleDownload} className="hover:text-white transition-colors flex items-center gap-1"><span>💾</span> Bajar</button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-xs text-green-400 font-mono">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};

export default function AppUI() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState([]); 
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [isSaved, setIsSaved] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeModel, setActiveModel] = useState('deepseek'); 
  const [specificModel, setSpecificModel] = useState('deepseek-chat'); 
  const [activePersona, setActivePersona] = useState('default');
  const [videoFiles, setVideoFiles] = useState([]);
  const [isRendering, setIsRendering] = useState(false);
  const [ffmpegLog, setFfmpegLog] = useState("🎬 Estudio de video preparado. Listo para cargar clips.");
  const [videoResult, setVideoResult] = useState(null);
  
  const ffmpegRef = useRef(null);
  const [keys, setKeys] = useState({ gemini: '', openai: '', claude: '', deepseek: '', alibaba: '', nvidia: '', ghl: '' });

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  useEffect(() => {
    if (MODEL_VERSIONS[activeModel]) setSpecificModel(MODEL_VERSIONS[activeModel][0].id);
  }, [activeModel]);

  useEffect(() => {
    const loadedKeys = {
      gemini: localStorage.getItem('key_gemini') || '',
      openai: localStorage.getItem('key_openai') || '',
      claude: localStorage.getItem('key_claude') || '',
      deepseek: localStorage.getItem('key_deepseek') || '',
      alibaba: localStorage.getItem('key_alibaba') || '',
      nvidia: localStorage.getItem('key_nvidia') || '',
      ghl: localStorage.getItem('key_ghl') || ''
    };
    setKeys(loadedKeys);
    
    const savedChats = localStorage.getItem('tupia_chats');
    let parsedChats = savedChats ? JSON.parse(savedChats) : [];
    if (parsedChats.length > 0) {
      setChats(parsedChats);
      const savedCurrentId = localStorage.getItem('tupia_current_chat');
      setCurrentChatId(savedCurrentId && parsedChats.find(c => c.id === savedCurrentId) ? savedCurrentId : parsedChats[0].id);
      addLog("[OK] Historial de salas restaurado.");
    } else {
      createNewChat();
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('tupia_chats', JSON.stringify(chats));
      if (currentChatId) localStorage.setItem('tupia_current_chat', currentChatId);
    }
  }, [chats, currentChatId]);

  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, currentChatId, activeTab]);

  const createNewChat = () => {
    const newId = Date.now().toString();
    setChats(prev => [{ id: newId, title: "Nuevo Chat", messages: [] }, ...prev]);
    setCurrentChatId(newId);
    setIsSidebarOpen(false);
  };

  const deleteChat = (id) => {
    if (window.confirm("¿Seguro que quieres borrar este chat?")) {
      const newChats = chats.filter(c => c.id !== id);
      if (newChats.length === 0) createNewChat();
      else { setChats(newChats); if (currentChatId === id) setCurrentChatId(newChats[0].id); }
    }
  };

  const saveSettings = () => {
    Object.entries(keys).forEach(([provider, key]) => localStorage.setItem(`key_${provider}`, key));
    setIsSaved(true);
    addLog("[INFO] APIs y CRM guardados en la bóveda.");
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = [];
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise(res => reader.onload = () => {
          newAttachments.push({ type: 'image', name: file.name, mime: file.type, data: reader.result });
          res();
        });
      } else {
        const text = await file.text();
        newAttachments.push({ type: 'text', name: file.name, data: text });
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    fileInputRef.current.value = ""; 
  };

  const handleStudioMedia = (e) => {
    const files = Array.from(e.target.files);
    setVideoFiles(prev => [...prev, ...files.map(f => ({ file: f, name: f.name, id: Date.now() + Math.random() }))]);
    setFfmpegLog(`[INFO] Cargados ${files.length} archivos multimedia al estudio.`);
  };

  // 🚀 MOTOR FFMPEG ABSOLUTO: WORKER LOCAL + MATEMÁTICA DE TIEMPO 🚀
  const runFfmpegRender = async () => {
    if (videoFiles.length === 0) {
      alert("Sube algunas imágenes al Estudio primero para poder procesar.");
      return;
    }
    
    setIsRendering(true);
    setVideoResult(null);
    setFfmpegLog("[INFO] Despertando al motor FFmpeg integrado de Vite...");

    try {
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }
      
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on('log', ({ message }) => {
        setFfmpegLog(prev => `${prev}\n[FFMPEG] ${message}`);
      });

      if (!ffmpeg.loaded) {
        setFfmpegLog(prev => `${prev}\n[INFO] Conectando Worker local y descargando núcleos vía Blob (ESM)...`);
        
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
        });
      }

      setFfmpegLog(prev => `${prev}\n[INFO] Escribiendo fotos (Normalizando a JPG perfecto)...`);

      for (let i = 0; i < videoFiles.length; i++) {
        const jpgBlob = await normalizeImageToJPG(videoFiles[i].file);
        const fileData = await fetchFile(jpgBlob);
        await ffmpeg.writeFile(`img${i}.jpg`, fileData);
      }

      // 🔥 MATEMÁTICA DE TIEMPO EXACTA 🔥
      const segundosPorFoto = 3;
      const duracionTotal = videoFiles.length * segundosPorFoto;

      setFfmpegLog(prev => `${prev}\n[INFO] Procesando slideshow de ${duracionTotal} segundos...`);

      const codigoRetorno = await ffmpeg.exec([
        '-framerate', `1/${segundosPorFoto}`, // Fija la duración de cada foto a 3 segundos
        '-loop', '1',                         // Obliga a que la secuencia se repita sin morir al instante
        '-t', `${duracionTotal}`,             // Corta el video exactamente cuando termine el lote
        '-start_number', '0',                 // Asegura que empiece a leer desde la foto img0.jpg
        '-i', 'img%d.jpg',   
        '-c:v', 'libx264',   
        '-r', '30',          
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
        'output.mp4'         
      ]);

      if (codigoRetorno !== 0) {
        throw new Error("FFmpeg chocó durante la conversión (Código " + codigoRetorno + "). Revisa los logs arriba.");
      }

      setFfmpegLog(prev => `${prev}\n[INFO] Video procesado, generando MP4...`);

      const data = await ffmpeg.readFile('output.mp4');
      const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(videoBlob);

      setVideoResult(videoUrl);
      setFfmpegLog(prev => `${prev}\n✅ ¡ÉXITO ABSOLUTO! Video exportado perfectamente (${duracionTotal}s).`);

    } catch (error) {
      console.error(error);
      setFfmpegLog(prev => `${prev}\n❌ ERROR DETECTADO: ${error?.message || error}`);
    } finally {
      setIsRendering(false);
    }
  };

  const renderMessageContent = (text) => {
    if (typeof text !== 'string') return <p>Archivo procesado.</p>;
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        return match ? <CodeBlock key={index} lang={match[1]} code={match[2]} /> : <CodeBlock key={index} lang="txt" code={part.slice(3, -3)} />;
      }
      return <p key={index} className="whitespace-pre-wrap leading-relaxed">{part}</p>;
    });
  };

  const activeChat = chats.find(c => c.id === currentChatId) || { messages: [] };
  const currentMessages = activeChat.messages;

  const updateCurrentChatMessages = (newMsgs, newTitle = null) => {
    setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: newMsgs, title: newTitle || chat.title } : chat));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const currentKey = keys[activeModel];
    if (!currentKey) {
      alert(`⚠️ Falta tu API Key para ${activeModel.toUpperCase()}!`);
      setActiveTab('settings'); return;
    }

    const textFiles = attachments.filter(a => a.type === 'text');
    let finalInput = input;
    if (textFiles.length > 0) {
      finalInput += "\n\n" + textFiles.map(a => `--- ARCHIVO: ${a.name} ---\n${a.data}\n--- FIN DE ARCHIVO ---`).join('\n\n');
    }
    const images = attachments.filter(a => a.type === 'image');
    
    const displayUserText = input + (attachments.length > 0 ? `\n[+ ${attachments.length} archivos]` : '');
    const newMessages = [...currentMessages, { role: 'user', content: displayUserText, rawContent: finalInput }];
    
    let chatTitle = activeChat.title;
    if (currentMessages.length === 0 && input.trim() !== "") {
      chatTitle = input.substring(0, 30) + (input.length > 30 ? '...' : '');
    }

    updateCurrentChatMessages(newMessages, chatTitle);
    setInput(""); setAttachments([]); setIsLoading(true);
    addLog(`Enviando a ${specificModel} (Modo: ${activePersona})...`);

    const history = currentMessages.slice(-10).map(m => ({ role: m.role, content: m.rawContent || m.content }));
    const systemInstruction = PERSONAS[activePersona];

    try {
      let botReply = "";

      if (activeModel === 'gemini') {
        const geminiHistory = history.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
        const currentParts = [{ text: finalInput }];
        images.forEach(img => currentParts.push({ inline_data: { mime_type: img.mime, data: img.data.split(',')[1] } }));
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${specificModel}:generateContent?key=${currentKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system_instruction: { parts: [{ text: systemInstruction }] }, contents: [...geminiHistory, { role: 'user', parts: currentParts }] })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        botReply = data.candidates[0].content.parts[0].text;
      }
      else if (activeModel === 'claude') {
        const claudeHistory = history.map(m => ({ role: m.role, content: m.content }));
        const currentContent = [{ type: 'text', text: finalInput }];
        images.forEach(img => currentContent.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data.split(',')[1] } }));

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': currentKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: specificModel, max_tokens: 4096, system: systemInstruction, messages: [...claudeHistory, { role: 'user', content: currentContent }] })
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
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentKey}` },
          body: JSON.stringify({ 
            model: specificModel, 
            messages: [{ role: 'system', content: systemInstruction }, ...standardHistory, { role: 'user', content: currentContent }] 
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        botReply = data.choices[0].message.content;
      }

      if (activePersona === 'director') {
        try {
          const config = JSON.parse(botReply);
          botReply = `🎬 **Instrucciones Cinematográficas Calculadas:**\n\n` +
                     `- **Ritmo Emocional:** ${config.emocion_detectada}\n` +
                     `- **Velocidad de Corte:** ${config.duracion_clip_segundos}s\n` +
                     `- **Fuerza del Zoom:** ${config.zoom_inicial}x ➔ ${config.zoom_final}x\n` +
                     `- **Eje X (Matemática):** \`${config.matematica_zoompan_x}\`\n` +
                     `- **Eje Y (Matemática):** \`${config.matematica_zoompan_y}\`\n\n` +
                     `*💬 Nota de Dirección:* ${config.explicacion_decisiones}`;
        } catch (e) {}
      }

      updateCurrentChatMessages([...newMessages, { role: 'assistant', content: botReply }]);
    } catch (error) {
      updateCurrentChatMessages([...newMessages, { role: 'assistant', content: `❌ Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="text-2xl text-gray-300 hover:text-white px-2 rounded hover:bg-gray-800 transition">☰</button>
          <h1 className="font-bold text-lg tracking-tight text-blue-400">Tupia Workspace</h1>
        </div>
        <button onClick={createNewChat} className="bg-blue-600/30 text-blue-400 border border-blue-800/50 px-3 py-1 rounded-full text-xs font-bold hover:bg-blue-600 hover:text-white transition-colors">➕ Nuevo</button>
      </header>

      {/* SIDEBAR */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex animate-in fade-in duration-200">
          <div className="w-4/5 max-w-sm bg-gray-950 h-full border-r border-gray-800 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
              <h2 className="font-bold text-lg text-white">Tus Chats</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white text-3xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chats.map(chat => (
                <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }} className={`p-3 rounded-lg flex justify-between items-center cursor-pointer transition-all ${chat.id === currentChatId ? 'bg-blue-900/40 border border-blue-500/50 text-blue-300' : 'hover:bg-gray-900 text-gray-400'}`}>
                  <span className="truncate flex-1 text-sm font-medium">{chat.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} className="text-gray-600 hover:text-red-400 ml-2 p-1">🗑️</button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsSidebarOpen(false)}></div>
        </div>
      )}

      {/* CUERPO CENTRAL */}
      <main className="flex-1 overflow-y-auto pb-48 relative">
        
        {/* TAB 1: CHAT */}
        {activeTab === 'chat' && (
          <div className="p-4 space-y-4">
            {currentMessages.length === 0 && (
              <div className="text-center text-gray-500 mt-10 bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                <span className="text-5xl block mb-4">🧩</span>
                <p className="font-bold text-gray-300">El Método PTB + Editor</p>
                <p className="text-sm mt-2">Usa Plan 🗺️ ➔ Think 🤔 ➔ Build 🏗️ o cambia al Director de Cine 🎬</p>
              </div>
            )}
            
            {currentMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] p-4 rounded-2xl text-sm shadow-md ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-900 text-gray-100 border border-gray-700 rounded-bl-sm w-full'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700/50">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1">🤖 Tupia AI</span>
                      <button onClick={() => navigator.clipboard.writeText(msg.content)} className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-gray-400 hover:text-white bg-gray-800 px-2 py-1 rounded transition-colors">
                        📋 Copiar Todo
                      </button>
                    </div>
                  )}
                  {msg.role === 'user' ? <p className="whitespace-pre-wrap">{msg.content}</p> : renderMessageContent(msg.content)}
                </div>
              </div>
            ))}
            {isLoading && <div className="p-3 rounded-2xl bg-gray-800 border border-gray-700 text-gray-400 animate-pulse text-sm max-w-[50%]">Pensando...</div>}
            <div ref={chatBottomRef} />
          </div>
        )}

        {/* TAB 2: ESTUDIO DE VIDEO */}
        {activeTab === 'studio' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2 flex items-center gap-2 text-red-400">
              <span>🎬</span> Tupia Video Engine
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">Motor V12 Single-Thread cargado. No necesita permisos de memoria y evita cualquier bloqueo en celulares.</p>
            
            <div className="bg-gray-900 p-6 rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center text-center cursor-pointer hover:border-red-500/40 transition-colors" onClick={() => document.getElementById('studio-upload').click()}>
              <span className="text-4xl mb-2">🎞️</span>
              <span className="text-sm font-bold text-gray-300">Seleccionar Lote de Imágenes</span>
              <span className="text-[10px] text-gray-500 mt-1">Soporta PNG, JPG, JPEG</span>
              <input id="studio-upload" type="file" multiple className="hidden" accept="image/*" onChange={handleStudioMedia} />
            </div>

            {videoFiles.length > 0 && (
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="text-xs font-bold text-gray-400 mb-2">Cola de procesamiento ({videoFiles.length} archivos):</p>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {videoFiles.map((f, i) => (
                    <div key={f.id} className="bg-gray-900 p-2 rounded-lg text-xs truncate flex justify-between items-center border border-gray-800">
                      <span className="truncate flex-1 text-gray-300">{f.name}</span>
                      <button onClick={() => setVideoFiles(prev => prev.filter(item => item.id !== f.id))} className="text-red-500 font-bold ml-2">X</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={runFfmpegRender} disabled={isRendering || videoFiles.length === 0} className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 ${isRendering ? 'bg-amber-600 animate-pulse' : 'bg-gradient-to-r from-red-600 to-amber-600 text-white disabled:opacity-50'}`}>
              {isRendering ? "⚙️ Renderizando Lote..." : "🎬 Compilar Lote en Video"}
            </button>

            {videoResult && (
              <div className="mt-6 bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-2xl">
                <h3 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">✅ Video Generado</h3>
                <video src={videoResult} controls className="w-full rounded-lg bg-black aspect-[9/16] object-contain shadow-inner" />
                <a href={videoResult} download="Tupia_Faceless_Video.mp4" className="mt-4 w-full block text-center bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors">
                  💾 Descargar MP4
                </a>
              </div>
            )}

            <div className="bg-black border border-gray-800 p-4 rounded-xl font-mono text-xs text-red-400 h-40 overflow-y-auto shadow-inner whitespace-pre-wrap">
              <p>{ffmpegLog}</p>
            </div>
          </div>
        )}

        {/* TAB 3: BÓVEDA */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2">🔑 Bóveda de APIs</h2>
            {['openai', 'claude', 'gemini', 'deepseek', 'alibaba', 'nvidia', 'ghl'].map((id) => (
              <div key={id} className="bg-gray-900 p-3 rounded-xl border border-gray-800">
                <label className="block text-sm font-bold text-gray-300 mb-1 capitalize">
                  {id === 'ghl' ? 'GoHighLevel (CRM)' : id}
                </label>
                <input type="password" value={keys[id]} onChange={(e) => setKeys(prev => ({...prev, [id]: e.target.value}))} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 text-sm" placeholder="Pega tu token aquí..." />
              </div>
            ))}
            <button onClick={saveSettings} className={`w-full font-bold py-3 rounded-xl shadow-lg ${isSaved ? 'bg-green-600' : 'bg-blue-600'}`}>
              {isSaved ? "✅ Guardado" : "💾 Guardar Llaves"}
            </button>
          </div>
        )}

        {/* TAB 4: LOGS */}
        {activeTab === 'logs' && (
          <div className="p-4 h-full flex flex-col">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2 mb-4">📋 Consola Técnica</h2>
            <div className="bg-black flex-1 rounded-xl p-4 font-mono text-xs text-green-400 overflow-y-auto border border-gray-800 pb-20">
              {logs.map((log, i) => <p key={i} className="mb-2">{log}</p>)}
            </div>
          </div>
        )}
      </main>

      {/* PANEL DE ESCRITURA */}
      {activeTab === 'chat' && (
        <div className="fixed bottom-[70px] left-0 w-full bg-gray-900 border-t border-gray-800 z-10 p-2 flex flex-col gap-2 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          <div className="grid grid-cols-3 gap-1">
            <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)} className="bg-black border border-gray-700 text-[10px] md:text-xs text-blue-400 font-bold rounded-lg p-2 outline-none">
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="alibaba">Alibaba</option>
              <option value="nvidia">Nvidia</option>
            </select>

            <select value={specificModel} onChange={(e) => setSpecificModel(e.target.value)} className="bg-black border border-gray-700 text-[10px] md:text-xs text-green-400 font-bold rounded-lg p-2 outline-none">
              {MODEL_VERSIONS[activeModel] && MODEL_VERSIONS[activeModel].map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            <select value={activePersona} onChange={(e) => setActivePersona(e.target.value)} className="bg-black border border-gray-700 text-[10px] md:text-xs text-purple-400 font-bold rounded-lg p-2 outline-none truncate">
              <option value="plan">🗺️ Plan</option>
              <option value="think">🤔 Think</option>
              <option value="build">🏗️ Build</option>
              <option value="director">🎬 Director</option>
              <option value="default">🗣️ Normal</option>
              <option value="youtube">▶️ YouTube</option>
              <option value="infoproducto">📦 Venta</option>
            </select>
          </div>

          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachments.map((file, idx) => (
                <div key={idx} className="bg-gray-800 text-xs text-gray-300 px-3 py-1 rounded-full flex items-center border border-gray-700">
                  <span className="truncate max-w-[80px]">{file.name}</span>
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="ml-2 text-red-400 font-bold">X</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 w-full">
            <button type="button" onClick={() => fileInputRef.current.click()} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 w-[50px] rounded-xl flex justify-center items-center">📎</button>
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <input className="flex-1 bg-black border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-sm" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Instrucción..." />
            <button type="submit" disabled={(!input.trim() && attachments.length===0) || isLoading} className="bg-blue-600 disabled:bg-gray-800 w-[50px] rounded-xl font-bold text-white">➤</button>
          </form>
        </div>
      )}

      {/* MENÚ INFERIOR MÓVIL */}
      <nav className="fixed bottom-0 left-0 w-full bg-gray-950 border-t border-gray-800 flex justify-around p-2 z-20 h-[70px]">
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='chat'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">💬</span><span className="text-[9px] font-bold">CHAT</span></button>
        <button onClick={() => setActiveTab('studio')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='studio'?'text-red-500':'text-gray-500'}`}><span className="text-lg">🎬</span><span className="text-[9px] font-bold">ESTUDIO</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='settings'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">⚙️</span><span className="text-[9px] font-bold">BÓVEDA</span></button>
        <button onClick={() => setActiveTab('logs')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='logs'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">📋</span><span className="text-[9px] font-bold">LOGS</span></button>
      </nav>
    </div>
  );
}
