import React, { useState, useRef, useEffect } from "react";
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
  director: `Eres Tupia MODO DIRECTOR DE CINE. Recibirás una temática del usuario. Tu trabajo es escribir un guion para un Short/Reel impactante.
⚠️ DEBES DEVOLVER ÚNICA Y EXCLUSIVAMENTE UN ARRAY JSON VÁLIDO. SIN TEXTO ANTES NI DESPUÉS. ⚠️
El JSON debe tener esta estructura exacta para al menos 3 escenas:
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
    "efecto_camara": "zoom_out_3d",
    "duracion": 5
  }
]
Efectos permitidos: "zoom_in_3d", "zoom_out_3d", "pan_right", "pan_left".`,
  youtube: "Eres Tupia MODO YOUTUBE. Eres un experto en retención de audiencia y el algoritmo de YouTube. Creas Títulos Virales y Ganchos (Hooks) irresistibles para los primeros 15 segundos.",
  infoproducto: "Eres Tupia MODO INFOPRODUCTO. Eres un experto en Marketing Digital y creación de Cursos Online. Diseñas ofertas irresistibles y copy persuasivo."
};

// 🔥 GENERADOR DE CAPAS (IMAGEN + TEXTO) 🔥
const createTikTokFrame = (file, textOverlay, fontSize, textColor) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080; 
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      
      // Fondo oscuro para evitar bordes blancos
      ctx.fillStyle = "#050505"; 
      ctx.fillRect(0, 0, 1080, 1920);
      
      // Escalar imagen tipo Cover
      const scale = Math.max(1080 / img.width, 1920 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (1080 - w) / 2, (1920 - h) / 2, w, h);
      
      // Estampar Textos si la IA los generó
      if (textOverlay) {
        ctx.font = `bold ${fontSize}px 'Impact', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(4, fontSize * 0.1);
        ctx.strokeStyle = "black";
        ctx.fillStyle = textColor;
        
        ctx.shadowColor = "rgba(0,0,0,0.9)"; 
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        const lines = textOverlay.split('\\n');
        lines.forEach((line, i) => {
           const yPos = 960 + (i * (parseInt(fontSize) + 20)) - ((lines.length - 1) * (parseInt(fontSize) / 2));
           ctx.strokeText(line, 540, yPos);
           ctx.fillText(line, 540, yPos);
        });
      }

      canvas.toBlob((blob) => { 
        URL.revokeObjectURL(url); 
        resolve(blob); 
      }, 'image/jpeg', 0.95);
    };
    img.onerror = () => resolve(null);
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
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800 text-xs font-bold text-gray-300">
        <span className="uppercase">{lang || 'TEXTO'}</span>
        <div className="flex gap-3">
          <button onClick={handleCopy} className="hover:text-white transition-colors">📋 Copiar</button>
          <button onClick={handleDownload} className="hover:text-white transition-colors">💾 Bajar</button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-xs text-green-400 font-mono"><code>{code.trim()}</code></pre>
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
  
  const [activeModel, setActiveModel] = useState('openai'); 
  const [specificModel, setSpecificModel] = useState('gpt-4o-mini'); 
  const [activePersona, setActivePersona] = useState('director');
  
  // 🔥 ESTADOS DEL EDITOR PRO 🔥
  const [videoFiles, setVideoFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [directorPlan, setDirectorPlan] = useState(null); 
  const [fontSize, setFontSize] = useState(90);
  const [textColor, setTextColor] = useState("#FF0050");
  const [isRendering, setIsRendering] = useState(false);
  const [ffmpegLog, setFfmpegLog] = useState("🎬 Motor 3D listo para generar.");
  const [videoResult, setVideoResult] = useState(null);
  
  const ffmpegRef = useRef(null);
  const [keys, setKeys] = useState({ gemini: '', openai: '', claude: '', deepseek: '', alibaba: '', nvidia: '', ghl: '' });

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  useEffect(() => { if (MODEL_VERSIONS[activeModel]) setSpecificModel(MODEL_VERSIONS[activeModel][0].id); }, [activeModel]);

  useEffect(() => {
    const loadedKeys = {
      gemini: localStorage.getItem('key_gemini') || '', openai: localStorage.getItem('key_openai') || '',
      claude: localStorage.getItem('key_claude') || '', deepseek: localStorage.getItem('key_deepseek') || '',
      alibaba: localStorage.getItem('key_alibaba') || '', nvidia: localStorage.getItem('key_nvidia') || '', ghl: localStorage.getItem('key_ghl') || ''
    };
    setKeys(loadedKeys);
    
    const savedChats = localStorage.getItem('tupia_chats');
    let parsedChats = savedChats ? JSON.parse(savedChats) : [];
    if (parsedChats.length > 0) {
      setChats(parsedChats);
      const savedCurrentId = localStorage.getItem('tupia_current_chat');
      setCurrentChatId(savedCurrentId && parsedChats.find(c => c.id === savedCurrentId) ? savedCurrentId : parsedChats[0].id);
      addLog("[OK] Historial restaurado.");
    } else { createNewChat(); }
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('tupia_chats', JSON.stringify(chats));
      if (currentChatId) localStorage.setItem('tupia_current_chat', currentChatId);
    }
  }, [chats, currentChatId]);

  useEffect(() => { if (activeTab === 'chat' && chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chats, currentChatId, activeTab]);

  const createNewChat = () => {
    const newId = Date.now().toString();
    setChats(prev => [{ id: newId, title: "Nuevo Chat", messages: [] }, ...prev]);
    setCurrentChatId(newId); setIsSidebarOpen(false);
  };

  const deleteChat = (id) => {
    if (window.confirm("¿Seguro que quieres borrar este chat?")) {
      const newChats = chats.filter(c => c.id !== id);
      if (newChats.length === 0) createNewChat(); else { setChats(newChats); if (currentChatId === id) setCurrentChatId(newChats[0].id); }
    }
  };

  const saveSettings = () => {
    Object.entries(keys).forEach(([provider, key]) => localStorage.setItem(`key_${provider}`, key));
    setIsSaved(true); setTimeout(() => setIsSaved(false), 2000);
    addLog("[INFO] Llaves guardadas.");
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
  };

  // ==========================================================
  // 🚀 MOTOR RENDER 3D: ARQUITECTURA LIMPIA Y EXACTA 🚀
  // ==========================================================
  const runFfmpegRender = async () => {
    if (videoFiles.length === 0) return alert("Sube imágenes al Estudio primero.");
    setIsRendering(true); 
    setVideoResult(null);
    setFfmpegLog("[INFO] Despertando al motor 3D CapCut de Tupia...");

    try {
      if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on('log', ({ message }) => setFfmpegLog(prev => `${prev}\n[FFMPEG] ${message}`));

      if (!ffmpeg.loaded) {
        setFfmpegLog(prev => `${prev}\n[INFO] Conectando Worker local (ESM)...`);
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
        });
      }

      setFfmpegLog(prev => `${prev}\n[INFO] ✍️ Renderizando Textos y Lienzos...`);
      for (let i = 0; i < videoFiles.length; i++) {
        const textoIA = directorPlan && directorPlan[i] ? directorPlan[i].texto_pantalla : null;
        const jpgBlob = await createTikTokFrame(videoFiles[i].file, textoIA, fontSize, textColor);
        await ffmpeg.writeFile(`img${i}.jpg`, await fetchFile(jpgBlob));
      }

      let ffmpegArgs = [];
      
      // 1. AÑADIR INPUTS DE VIDEO (Garantizando el tiempo por clip de la IA o 5s)
      for (let i = 0; i < videoFiles.length; i++) {
        const clipDur = directorPlan && directorPlan[i] ? directorPlan[i].duracion : 5;
        ffmpegArgs.push('-loop', '1', '-t', `${clipDur}`, '-i', `img${i}.jpg`);
      }
      
      // 2. AÑADIR INPUT DE AUDIO
      if (audioFile) {
        setFfmpegLog(prev => `${prev}\n[INFO] 🎵 Cargando música...`);
        await ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile));
        ffmpegArgs.push('-i', 'audio.mp3');
      }

      setFfmpegLog(prev => `${prev}\n[INFO] 🎥 Calculando Efectos Matemáticos...`);
      
      let filterComplex = "";
      let concatInputs = "";
      let duracionTotal = 0;
      const fps = 30;

      // 3. CONSTRUIR FILTROS DE MOVIMIENTO
      for (let i = 0; i < videoFiles.length; i++) {
        const clipDur = directorPlan && directorPlan[i] ? directorPlan[i].duracion : 5;
        const clipEfecto = directorPlan && directorPlan[i] ? directorPlan[i].efecto_camara : "zoom_in_3d";
        const frames = Math.round(clipDur * fps);
        duracionTotal += clipDur;

        let cameraFX = "";
        if (clipEfecto === 'zoom_in_3d' || clipEfecto === 'zoom_out_3d') { 
          cameraFX = `scale=1200:2133,rotate='0.02*sin(t)':ow=1200:oh=2133:c=black,zoompan=z='min(zoom+0.0015,1.2)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
        } else if (clipEfecto === 'pan_right') {
          cameraFX = `scale=1200:2133,zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)+in*2':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
        } else { 
          cameraFX = `scale=1200:2133,zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)-in*2':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
        }

        if (!directorPlan) {
          const mod = i % 3;
          if (mod === 0) cameraFX = `scale=1200:2133,rotate='0.02*sin(t)':ow=1200:oh=2133:c=black,zoompan=z='min(zoom+0.002,1.2)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
          if (mod === 1) cameraFX = `scale=1200:2133,zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)+in*2':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
          if (mod === 2) cameraFX = `scale=1200:2133,zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)-in*2':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
        }

        filterComplex += `[${i}:v]${cameraFX}[v${i}];`;
        concatInputs += `[v${i}]`;
      }

      if (videoFiles.length > 1) {
          filterComplex += `${concatInputs}concat=n=${videoFiles.length}:v=1:a=0[outv]`;
          ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[outv]');
      } else {
          filterComplex = filterComplex.slice(0, -1);
          ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[v0]');
      }

      // 4. MAPEO ESTRICTO DE AUDIO Y CONFIGURACIÓN FINAL DE TIEMPO
      if (audioFile) {
        const audioInputIndex = videoFiles.length; 
        ffmpegArgs.push('-map', `${audioInputIndex}:a`, '-c:a', 'aac', '-b:a', '192k');
      }

      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-t', `${duracionTotal}`, // 🔥 EL LÍMITE MAESTRO Y EXACTO DE TIEMPO 🔥
        'output.mp4'
      );

      setFfmpegLog(prev => `${prev}\n[INFO] Ejecutando render final (Límite matemático forzado a ${duracionTotal}s)...`);
      const codigoRetorno = await ffmpeg.exec(ffmpegArgs);

      if (codigoRetorno !== 0) throw new Error("Compilación fallida. Código: " + codigoRetorno);

      const data = await ffmpeg.readFile('output.mp4');
      const videoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

      setVideoResult(videoUrl);
      setFfmpegLog(prev => `${prev}\n✅ ¡OBRA MAESTRA LISTA! Duración exacta: ${duracionTotal}s.`);

    } catch (error) {
      console.error(error); 
      setFfmpegLog(prev => `${prev}\n❌ ERROR: ${error?.message || error}`);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const currentKey = keys[activeModel];
    if (!currentKey) { alert(`⚠️ Falta tu API Key para ${activeModel.toUpperCase()}!`); setActiveTab('settings'); return; }

    const finalInput = input;
    const newMessages = [...activeChat.messages, { role: 'user', content: input, rawContent: finalInput }];
    setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: newMessages } : chat));
    setInput(""); setIsLoading(true); setAttachments([]);
    addLog(`Consultando al ${activePersona}...`);

    try {
      const history = newMessages.slice(-5).map(m => ({ role: m.role, content: m.rawContent || m.content }));
      
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentKey}` },
        body: JSON.stringify({ 
          model: 'gpt-4o-mini', 
          messages: [{ role: 'system', content: PERSONAS[activePersona] }, ...history] 
        })
      });
      const data = await res.json();
      let botReply = data.choices[0].message.content;

      if (activePersona === 'director') {
        try {
          const jsonMatch = botReply.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const plan = JSON.parse(jsonMatch[0]);
            setDirectorPlan(plan);
            botReply = `🎬 **¡Dirección Lista!**\nConfiguré el Estudio con ${plan.length} escenas.\n\n` +
                       plan.map(p => `📽️ **Escena ${p.id + 1} (${p.duracion}s)**\n*Texto:* ${p.texto_pantalla}\n*Cámara:* ${p.efecto_camara}`).join('\n\n') +
                       `\n\n👉 ¡Ve a la pestaña ESTUDIO, ajusta el texto, sube tus fotos y Compila!`;
          }
        } catch (e) { console.error("Fallo parseando JSON Director", e); }
      }

      setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: [...newMessages, { role: 'assistant', content: botReply }] } : chat));
    } catch (error) {
      setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: [...newMessages, { role: 'assistant', content: `❌ Error: ${error.message}` }] } : chat));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white font-sans overflow-hidden">
      <header className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="text-2xl text-gray-300 hover:text-white px-2 rounded hover:bg-gray-800 transition">☰</button>
          <h1 className="font-bold text-lg tracking-tight text-blue-400">Tupia Workspace</h1>
        </div>
        <button onClick={createNewChat} className="bg-blue-600/30 text-blue-400 border border-blue-800/50 px-3 py-1 rounded-full text-xs font-bold hover:bg-blue-600 hover:text-white transition-colors">➕ Nuevo</button>
      </header>

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

      <main className="flex-1 overflow-y-auto pb-48 relative">
        {activeTab === 'chat' && (
          <div className="p-4 space-y-4">
            {activeChat.messages.length === 0 && (
              <div className="text-center text-gray-500 mt-10 bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                <span className="text-5xl block mb-4">🧩</span>
                <p className="font-bold text-gray-300">El Método PTB + Editor</p>
                <p className="text-sm mt-2">Usa Plan 🗺️ ➔ Think 🤔 ➔ Build 🏗️ o cambia al Director de Cine 🎬</p>
              </div>
            )}
            {activeChat.messages.map((msg, i) => (
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
            {isLoading && <div className="p-3 bg-gray-800 animate-pulse text-sm w-1/2 rounded-xl">Pensando...</div>}
            <div ref={chatBottomRef} />
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2 text-red-400">🎬 Tupia AI Video Director</h2>
            
            {directorPlan && (
              <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-xl">
                <span className="font-bold text-blue-300 text-sm">🧠 Plan Director Activo: {directorPlan.length} escenas.</span>
                <p className="text-xs text-gray-400 mt-1">Textos de IA listos para estampar. Ajusta la fuente abajo.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 bg-gray-950 p-4 rounded-xl border border-gray-800">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-2">Tamaño del Texto ({fontSize}px)</label>
                <input type="range" min="40" max="150" value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-full accent-red-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-2">Color del Texto</label>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border-none" />
              </div>
            </div>

            <div className="flex gap-4 w-full">
              <div className="flex-1 bg-gray-900 p-4 rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center cursor-pointer hover:border-red-500/40" onClick={() => document.getElementById('studio-upload').click()}>
                <span className="text-4xl mb-2">🎞️</span><span className="text-sm font-bold text-gray-300">Imágenes</span>
                <input id="studio-upload" type="file" multiple className="hidden" accept="image/*" onChange={handleStudioMedia} />
              </div>
              <div className="flex-1 bg-gray-900 p-4 rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/40" onClick={() => document.getElementById('audio-upload').click()}>
                <span className="text-4xl mb-2">🎵</span><span className="text-sm font-bold text-gray-300">{audioFile ? "Pista Lista" : "Música Fondo"}</span>
                <input id="audio-upload" type="file" className="hidden" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} />
                {audioFile && (
                  <button onClick={(e) => { e.stopPropagation(); setAudioFile(null); document.getElementById('audio-upload').value = ""; }} className="mt-2 text-[10px] bg-red-600/30 text-red-400 px-3 py-1 rounded-full hover:bg-red-600 hover:text-white">Quitar</button>
                )}
              </div>
            </div>

            {videoFiles.length > 0 && (
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="text-xs font-bold text-gray-400 mb-2">Secuencia Visual ({videoFiles.length} clips):</p>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {videoFiles.map(f => (
                    <div key={f.id} className="bg-gray-900 p-2 rounded-lg text-xs flex justify-between border border-gray-800">
                      <span className="truncate flex-1 text-gray-300">{f.name}</span>
                      <button onClick={() => setVideoFiles(prev => prev.filter(item => item.id !== f.id))} className="text-red-500 ml-2">X</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={runFfmpegRender} disabled={isRendering || videoFiles.length === 0} className={`w-full font-bold py-4 rounded-xl shadow-lg ${isRendering ? 'bg-amber-600 animate-pulse' : 'bg-gradient-to-r from-red-600 to-amber-600'}`}>
              {isRendering ? "⚙️ Renderizando Magia 3D..." : "🎬 Compilar Superproducción"}
            </button>

            {videoResult && (
              <div className="mt-6 bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-2xl shadow-red-500/20">
                <h3 className="text-sm font-bold text-green-400 mb-3">✅ Video Generado</h3>
                <video src={videoResult} controls className="w-full rounded-lg bg-black aspect-[9/16]" />
                <a href={videoResult} download="Tupia_Director_Video.mp4" className="mt-4 w-full block text-center bg-green-600 py-3 rounded-xl font-bold hover:bg-green-500 transition-colors">💾 Descargar MP4</a>
              </div>
            )}
            <div className="bg-black border border-gray-800 p-4 rounded-xl font-mono text-xs text-red-400 h-40 overflow-y-auto whitespace-pre-wrap">{ffmpegLog}</div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2">🔑 Bóveda de APIs</h2>
            {['openai', 'claude', 'gemini', 'deepseek', 'alibaba', 'nvidia', 'ghl'].map((id) => (
              <div key={id} className="bg-gray-900 p-3 rounded-xl border border-gray-800">
                <label className="block text-sm font-bold text-gray-300 mb-1 capitalize">{id === 'ghl' ? 'GoHighLevel (CRM)' : id}</label>
                <input type="password" value={keys[id]} onChange={(e) => setKeys(prev => ({...prev, [id]: e.target.value}))} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 text-sm" placeholder="Pega tu token aquí..." />
              </div>
            ))}
            <button onClick={saveSettings} className={`w-full font-bold py-3 rounded-xl shadow-lg ${isSaved ? 'bg-green-600' : 'bg-blue-600'}`}>
              {isSaved ? "✅ Guardado" : "💾 Guardar Llaves"}
            </button>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-4 h-full flex flex-col">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2 mb-4">📋 Consola Técnica</h2>
            <div className="bg-black flex-1 rounded-xl p-4 font-mono text-xs text-green-400 overflow-y-auto border border-gray-800 pb-20">
              {logs.map((log, i) => <p key={i} className="mb-2">{log}</p>)}
            </div>
          </div>
        )}
      </main>

      {activeTab === 'chat' && (
        <div className="fixed bottom-[70px] left-0 w-full bg-gray-900 border-t border-gray-800 z-10 p-2 flex flex-col gap-2 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          <div className="grid grid-cols-3 gap-1">
            <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)} className="bg-black border border-gray-700 text-[10px] md:text-xs text-blue-400 font-bold rounded-lg p-2 outline-none">
              <option value="openai">OpenAI (Director)</option>
              <option value="deepseek">DeepSeek</option>
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
            <select value={activePersona} onChange={(e) => setActivePersona(e.target.value)} className="bg-black border border-gray-700 text-[10px] md:text-xs text-purple-400 font-bold rounded-lg p-2 outline-none">
              <option value="default">🗣️ Normal</option>
              <option value="director">🎬 Director AI</option>
              <option value="plan">🗺️ Plan</option>
              <option value="think">🤔 Think</option>
              <option value="build">🏗️ Build</option>
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
            <input className="flex-1 bg-black border border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ej: Crea un video sobre vender casas..." />
            <button type="submit" disabled={(!input.trim() && attachments.length===0) || isLoading} className="bg-blue-600 disabled:bg-gray-800 w-[50px] rounded-xl font-bold text-white">➤</button>
          </form>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 w-full bg-gray-950 border-t border-gray-800 flex justify-around p-2 z-20 h-[70px]">
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='chat'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">💬</span><span className="text-[9px] font-bold">CHAT</span></button>
        <button onClick={() => setActiveTab('studio')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='studio'?'text-red-500':'text-gray-500'}`}><span className="text-lg">🎬</span><span className="text-[9px] font-bold">ESTUDIO</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='settings'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">⚙️</span><span className="text-[9px] font-bold">BÓVEDA</span></button>
        <button onClick={() => setActiveTab('logs')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='logs'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">📋</span><span className="text-[9px] font-bold">LOGS</span></button>
      </nav>
    </div>
  );
}
