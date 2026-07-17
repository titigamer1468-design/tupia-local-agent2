import React, { useState, useRef, useEffect } from "react";
import { MODEL_VERSIONS, PERSONAS, procesarConsultaIA, conectarModalServerless, generarImagenIA } from './AIManager.js';
import { renderVideo } from './VideoEngine.js';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

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
  
  // ESTADOS DEL ESTUDIO DE VIDEO
  const [videoFiles, setVideoFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [directorPlan, setDirectorPlan] = useState(null); 
  const [fontSize, setFontSize] = useState(90);
  const [textColor, setTextColor] = useState("#FF0050");
  const [videoFormat, setVideoFormat] = useState('vertical');
  const [engineMode, setEngineMode] = useState('local'); 
  const [isRendering, setIsRendering] = useState(false);
  const [ffmpegLog, setFfmpegLog] = useState("🎬 Motor 3D modular listo para generar.");
  const [videoResult, setVideoResult] = useState(null);

  // 🔥 ESTADOS DE LA FÁBRICA HÍBRIDA 🔥
  const [factoryMode, setFactoryMode] = useState('image'); 
  const [batchInput, setBatchInput] = useState("");
  const [isBatching, setIsBatching] = useState(false);
  const [batchStatus, setBatchStatus] = useState("Esperando instrucciones...");
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [zipUrl, setZipUrl] = useState(null);
  const [factoryImage, setFactoryImage] = useState(null); // 🔥 NUEVO ESTADO PARA LA IMAGEN DE INICIO 🔥
  
  const [keys, setKeys] = useState({ 
    gemini: '', openai: '', claude: '', deepseek: '', alibaba: '', nvidia: '', ghl: '', 
    vpsUrl: 'http://localhost:5000', 
    videoWebhook: '' 
  });

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  useEffect(() => { if (MODEL_VERSIONS[activeModel]) setSpecificModel(MODEL_VERSIONS[activeModel][0].id); }, [activeModel]);

  useEffect(() => {
    const loadedKeys = {
      gemini: localStorage.getItem('key_gemini') || '', openai: localStorage.getItem('key_openai') || '',
      claude: localStorage.getItem('key_claude') || '', deepseek: localStorage.getItem('key_deepseek') || '',
      alibaba: localStorage.getItem('key_alibaba') || '', nvidia: localStorage.getItem('key_nvidia') || '', ghl: localStorage.getItem('key_ghl') || '',
      vpsUrl: localStorage.getItem('key_vpsUrl') || 'http://localhost:5000',
      videoWebhook: localStorage.getItem('key_videoWebhook') || ''
    };
    setKeys(loadedKeys);
    
    const savedChats = localStorage.getItem('tupia_chats');
    let parsedChats = savedChats ? JSON.parse(savedChats) : [];
    if (parsedChats.length > 0) {
      setChats(parsedChats);
      setCurrentChatId(localStorage.getItem('tupia_current_chat') || parsedChats[0].id);
      addLog("[OK] Sistema iniciado.");
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
    addLog("[INFO] Configuración guardada en Bóveda.");
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
  // 🏭 ORQUESTADOR DE FÁBRICA (CONECTOR UNIVERSAL MODAL / VPS)
  // ==========================================================
  const handleBatchGeneration = async () => {
    const promptList = batchInput.split('\n').filter(p => p.trim() !== '');
    if (promptList.length === 0) return alert("Pega tus instrucciones primero.");

    if (!keys.videoWebhook) {
      return alert("¡No has configurado tu Webhook (Modal o VPS) en la Bóveda!");
    }

    setIsBatching(true);
    setBatchTotal(promptList.length);
    setBatchProgress(0);
    setBatchStatus(`Conectando con la Súper Fábrica en modo [${factoryMode.toUpperCase()}]...`);
    setZipUrl(null);
    
    const erroresLote = [];
    let reporteModal = `=== REPORTE DE TAREAS (${factoryMode.toUpperCase()}) ===\n\n`;

    try {
      if (!window.JSZip) {
        setBatchStatus("Cargando Motor ZIP...");
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error("Navegador bloqueó el Motor ZIP."));
          document.head.appendChild(script);
        });
      }

      const zip = new window.JSZip();

      for (let i = 0; i < promptList.length; i++) {
        const prompt = promptList[i];
        setBatchStatus(`Procesando tarea [${factoryMode.toUpperCase()}] ${i + 1} de ${promptList.length}...`);

        let intentos = 0;
        let ultimoError = "";
        let exito = false;
        
        while (intentos < 3 && !exito) {
          try {
            let workflowParaModal = prompt;
            try { workflowParaModal = JSON.parse(prompt); } catch (e) { /* Era solo texto, está bien */ }

            // 🔥 ENVÍO DIRECTO CON IMAGEN ADJUNTA 🔥
            const response = await fetch(keys.videoWebhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                workflow: workflowParaModal,
                imagen_base64: factoryImage // Aquí viaja tu foto si la adjuntaste
              })
            });
            
            if (!response.ok) throw new Error("Fallo de conexión HTTP");
            const respuestaWebhook = await response.json();
            
            // 🔥 GUARDAR FOTO O VIDEO EN EL ZIP 🔥
            if (respuestaWebhook.archivo_base64) {
              const ext = respuestaWebhook.extension || 'png';
              zip.folder("Resultados_Visuales").file(`Resultado_Modal_${i+1}.${ext}`, respuestaWebhook.archivo_base64, { base64: true });
              respuestaWebhook.archivo_base64 = `✅ [ARCHIVO .${ext.toUpperCase()} EXTRAÍDO Y GUARDADO EN CARPETA RESULTADOS_VISUALES]`; 
            } else if (respuestaWebhook.imagen_base64) { 
              // Soporte para la versión antigua por si acaso
              zip.folder("Resultados_Visuales").file(`Resultado_Modal_${i+1}.png`, respuestaWebhook.imagen_base64, { base64: true });
              respuestaWebhook.imagen_base64 = `✅ [ARCHIVO .PNG EXTRAÍDO Y GUARDADO EN CARPETA RESULTADOS_VISUALES]`;
            }

            reporteModal += `Tarea ${i+1}:\nOrden: ${prompt.substring(0,60)}...\nRespuesta Modal: ${JSON.stringify(respuestaWebhook)}\n\n`;
            exito = true;
            
          } catch (err) {
            ultimoError = err.message || "Error desconocido";
            intentos++;
            if (intentos >= 3) break;
            setBatchStatus(`🔄 Reintentando (${intentos}/3)...`);
            await new Promise(r => setTimeout(r, 4000));
          }
        }

        if (!exito) {
          console.warn(`Fallo en item ${i+1}: ${ultimoError}`);
          erroresLote.push(`Item ${i+1}: ${ultimoError}`);
          zip.folder("Errores").file(`ERROR_${i+1}.txt`, `Fallo al procesar.\nDatos: ${prompt}\nError: ${ultimoError}`);
        }
        
        setBatchProgress(i + 1);

        if (i < promptList.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      setBatchStatus("Empaquetando resultados...");
      
      zip.file("Reporte_Modal_Serverless.txt", reporteModal);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      setZipUrl(url);

      if (erroresLote.length > 0) {
        setBatchStatus(`⚠️ Finalizó con ${erroresLote.length} errores. Revisa los .txt en el ZIP.`);
      } else {
        setBatchStatus("✅ ¡Lote 100% Procesado con éxito! Descarga tu ZIP.");
      }

    } catch (error) {
      setBatchStatus(`❌ Error Crítico: ${error.message}`);
    } finally {
      setIsBatching(false);
    }
  };

  const handleRenderProcess = async () => {
    if (videoFiles.length === 0) return alert("Sube imágenes al Estudio primero.");
    setIsRendering(true);
    setVideoResult(null);
    setFfmpegLog("");

    try {
      if (engineMode === 'local') {
        const url = await renderVideo({
          videoFiles,
          audioFile,
          directorPlan,
          fontSize,
          textColor,
          videoFormat,
          onLog: (msg) => setFfmpegLog(prev => `${prev}\n${msg}`)
        });
        setVideoResult(url);
      } 
      else {
        setFfmpegLog("[INFO] 🌐 Empaquetando activos visuales para el servidor...");
        
        const base64Videos = await Promise.all(videoFiles.map(f => fileToBase64(f.file)));
        let audioBase64 = null;
        if (audioFile) audioBase64 = await fileToBase64(audioFile);

        const payload = {
          batchId: `lote_tupia_${Date.now()}`,
          videoFiles: base64Videos,
          audioUrl: audioBase64, 
          directorPlan,
          fontSize,
          textColor,
          videoFormat
        };

        setFfmpegLog(`[INFO] 🚀 Transmitiendo datos a la fábrica remota (${keys.vpsUrl})...`);
        const response = await fetch(`${keys.vpsUrl}/api/webhook/render-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || data.detalle || "Fallo en el Servidor VPS");

        setVideoResult(data.downloadUrl);
        setFfmpegLog(`[INFO] ✅ ¡El Servidor completó el render en tiempo récord!`);
      }
    } catch (error) {
      console.error(error);
      setFfmpegLog(prev => `${prev}\n❌ ERROR: ${error?.message || error}`);
    } finally {
      setIsRendering(false);
    }
  };

  const activeChat = chats.find(c => c.id === currentChatId) || { messages: [] };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const currentKey = keys[activeModel];
    if (!currentKey) { alert(`⚠️ Falta tu API Key para ${activeModel.toUpperCase()}!`); setActiveTab('settings'); return; }

    let finalInput = input;
    const textFiles = attachments.filter(a => a.type === 'text');
    if (textFiles.length > 0) {
      finalInput += "\n\n" + textFiles.map(a => `--- ARCHIVO: ${a.name} ---\n${a.data}\n--- FIN DE ARCHIVO ---`).join('\n\n');
    }
    const images = attachments.filter(a => a.type === 'image');

    const displayUserText = input + (attachments.length > 0 ? `\n[+ ${attachments.length} archivos]` : '');
    const newMessages = [...activeChat.messages, { role: 'user', content: displayUserText, rawContent: finalInput }];
    
    setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: newMessages } : chat));
    setInput(""); setIsLoading(true); setAttachments([]);
    addLog(`Consultando a ${activePersona.toUpperCase()} via ${activeModel}...`);

    try {
      const history = newMessages.slice(-5).map(m => ({ role: m.role, content: m.rawContent || m.content }));
      
      const { uiReply, directorPlan: planExtraido } = await procesarConsultaIA({
        activeModel, specificModel, activePersona, finalInput, history, images, currentKey
      });

      if (planExtraido) setDirectorPlan(planExtraido);

      setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: [...newMessages, { role: 'assistant', content: uiReply }] } : chat));
    } catch (error) {
      setChats(prev => prev.map(chat => chat.id === currentChatId ? { ...chat, messages: [...newMessages, { role: 'assistant', content: `❌ Error: ${error.message}` }] } : chat));
    } finally { setIsLoading(false); }
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
                      <button onClick={() => navigator.clipboard.writeText(msg.content)} className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-gray-400 hover:text-white bg-gray-800 px-2 py-1 rounded transition-colors">📋 Copiar Todo</button>
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

        {/* TAB FÁBRICA HÍBRIDA */}
        {activeTab === 'factory' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2 text-cyan-400 flex items-center gap-2">
              🏭 Súper Fábrica Serverless
            </h2>

            <div className="flex bg-gray-950 rounded-xl border border-gray-800 p-1 mb-4 shadow-lg shadow-black">
              <button 
                onClick={() => setFactoryMode('image')} 
                className={`flex-1 text-xs font-bold py-3 rounded-lg transition-colors ${factoryMode === 'image' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-gray-500 hover:text-white'}`}>
                📸 Webhooks Imagen
              </button>
              <button 
                onClick={() => setFactoryMode('video')} 
                className={`flex-1 text-xs font-bold py-3 rounded-lg transition-colors ${factoryMode === 'video' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-gray-500 hover:text-white'}`}>
                🎥 Webhooks Video
              </button>
            </div>
            
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
              <label className="block text-sm font-bold text-gray-300 mb-2">
                Pega tus Instrucciones o JSON para Modal/VPS Aquí
              </label>
              <textarea 
                value={batchInput} 
                onChange={(e) => setBatchInput(e.target.value)}
                className={`w-full bg-black border border-gray-700 rounded-lg p-3 text-sm font-mono h-64 outline-none resize-none focus:border-${factoryMode === 'image' ? 'cyan' : 'purple'}-500 ${factoryMode === 'image' ? 'text-cyan-400' : 'text-purple-400'}`}
                placeholder={"Ejemplo de JSON ComfyUI:\n{\n  \"3\": {\n    \"class_type\": \"KSampler\",\n    ...\n  }\n}"}
              />
              
              {/* 🔥 BOTÓN PARA ADJUNTAR LA IMAGEN INICIAL 🔥 */}
              <div className="mt-4 flex items-center gap-3">
                <input type="file" id="factoryImg" className="hidden" accept="image/*" onChange={async (e) => {
                    if(e.target.files[0]) {
                        const b64 = await fileToBase64(e.target.files[0]);
                        setFactoryImage(b64);
                    }
                }} />
                <button onClick={() => document.getElementById('factoryImg').click()} className="bg-gray-800 text-xs px-4 py-2 rounded-lg text-gray-300 border border-gray-700 hover:text-white transition-colors">
                    {factoryImage ? "✅ Imagen Cargada (Clic para cambiar)" : "📸 Adjuntar Imagen Inicial (Opcional)"}
                </button>
                {factoryImage && <button onClick={() => setFactoryImage(null)} className="text-red-400 text-xs font-bold">X Quitar</button>}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                ⚡ Todo el procesamiento se envía ahora a tu servidor (configurado en la Bóveda).
              </p>
            </div>

            {isBatching ? (
              <div className="bg-gray-950 p-4 rounded-xl border border-cyan-800/50 text-center">
                <p className="text-sm font-bold text-cyan-400 mb-2">{batchStatus}</p>
                <div className="w-full bg-gray-800 rounded-full h-4 mb-2 overflow-hidden">
                  <div className={`h-4 transition-all duration-300 ${factoryMode === 'image' ? 'bg-cyan-500' : 'bg-purple-500'}`} style={{ width: `${(batchProgress / batchTotal) * 100}%` }}></div>
                </div>
                <p className="text-xs text-gray-500">{batchProgress} de {batchTotal} tareas completadas</p>
              </div>
            ) : (
              <div className="space-y-4">
                <button onClick={handleBatchGeneration} className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all text-white ${factoryMode === 'image' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'}`}>
                  🚀 Disparar Tareas
                </button>
                
                {batchStatus.includes('❌') && (
                  <div className="bg-red-900/30 p-4 rounded-xl border border-red-500/50 text-center animate-in fade-in zoom-in duration-300">
                    <p className="text-sm font-bold text-red-400">{batchStatus}</p>
                  </div>
                )}
                
                {batchStatus.includes('✅') && !zipUrl && (
                  <div className="bg-green-900/30 p-4 rounded-xl border border-green-500/50 text-center animate-in fade-in zoom-in duration-300">
                    <p className="text-sm font-bold text-green-400">{batchStatus}</p>
                  </div>
                )}
              </div>
            )}

            {zipUrl && (
              <div className="mt-6 bg-gray-900 p-4 rounded-xl border border-green-500 shadow-2xl shadow-green-500/20 text-center animate-in fade-in zoom-in duration-300">
                <h3 className="text-base font-bold text-green-400 mb-3">✅ ¡ZIP Generado Exitosamente!</h3>
                <p className="text-xs text-gray-400 mb-4">Adentro encontrarás tu resultado final listo y el reporte completo de las tareas.</p>
                <a href={zipUrl} download={`Resultados_${factoryMode.toUpperCase()}_Lote_${Date.now()}.zip`} className="w-full block text-center bg-green-600 py-4 rounded-xl font-bold hover:bg-green-500 transition-colors text-white shadow-lg shadow-green-600/30">
                  📥 DESCARGAR ZIP
                </a>
              </div>
            )}
          </div>
        )}

        {/* TAB ESTUDIO */}
        {activeTab === 'studio' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2 flex items-center justify-between text-red-400">
              <span>🎬 Tupia Director</span>
              <select value={engineMode} onChange={(e)=>setEngineMode(e.target.value)} className="bg-gray-900 text-xs text-white border border-gray-700 rounded-lg p-1">
                <option value="local">⚙️ Procesar en Celular</option>
                <option value="vps">🚀 Enviar al Servidor VPS</option>
              </select>
            </h2>
            
            {directorPlan && (
              <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-xl">
                <span className="font-bold text-blue-300 text-sm">🧠 Plan Director Activo: {directorPlan.length} escenas.</span>
                <p className="text-xs text-gray-400 mt-1">Textos de IA listos para estampar. Ajusta la fuente abajo.</p>
              </div>
            )}

            <div className="flex bg-gray-950 rounded-xl border border-gray-800 p-1 mb-4">
              <button onClick={() => setVideoFormat('horizontal')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${videoFormat === 'horizontal' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}>
                🖥️ Horizontal (16:9)
              </button>
              <button onClick={() => setVideoFormat('vertical')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${videoFormat === 'vertical' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}>
                📱 Vertical (9:16)
              </button>
            </div>

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

            <button onClick={handleRenderProcess} disabled={isRendering || videoFiles.length === 0} className={`w-full font-bold py-4 rounded-xl shadow-lg ${isRendering ? 'bg-amber-600 animate-pulse' : 'bg-gradient-to-r from-red-600 to-amber-600'}`}>
              {isRendering ? "⚙️ Renderizando Magia 3D..." : `🎬 Renderizar en ${engineMode.toUpperCase()}`}
            </button>

            {videoResult && (
              <div className="mt-6 bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-2xl shadow-red-500/20">
                <h3 className="text-sm font-bold text-green-400 mb-3">✅ Video Generado</h3>
                <video src={videoResult} controls className={`w-full rounded-lg bg-black ${videoFormat === 'horizontal' ? 'aspect-video' : 'aspect-[9/16]'}`} />
                <a href={videoResult} download={`Tupia_Director_${videoFormat}.mp4`} className="mt-4 w-full block text-center bg-green-600 py-3 rounded-xl font-bold hover:bg-green-500 transition-colors">💾 Descargar MP4</a>
              </div>
            )}
            <div className="bg-black border border-gray-800 p-4 rounded-xl font-mono text-xs text-red-400 h-40 overflow-y-auto whitespace-pre-wrap">{ffmpegLog}</div>
          </div>
        )}

        {/* TAB BÓVEDA */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-bold border-b border-gray-800 pb-2">🔑 Bóveda de Configuración</h2>
            
            <div className="bg-gray-900 p-3 rounded-xl border border-gray-800">
              <label className="block text-sm font-bold text-green-400 mb-1">🔗 Webhook Universal (Modal / VPS)</label>
              <input type="text" value={keys.videoWebhook} onChange={(e) => setKeys(prev => ({...prev, videoWebhook: e.target.value}))} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white focus:border-green-500 text-sm" placeholder="Ej: https://tu-url.modal.run..." />
              <p className="text-[10px] text-gray-500 mt-1">Aquí es donde la "Fábrica" enviará las peticiones JSON y las fotos que subas.</p>
            </div>

            {['openai', 'claude', 'gemini', 'deepseek', 'alibaba', 'nvidia', 'ghl'].map((id) => (
              <div key={id} className="bg-gray-900 p-3 rounded-xl border border-gray-800 mt-2">
                <label className="block text-sm font-bold text-gray-300 mb-1 capitalize">{id === 'ghl' ? 'GoHighLevel (CRM)' : id}</label>
                <input type="password" value={keys[id]} onChange={(e) => setKeys(prev => ({...prev, [id]: e.target.value}))} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white focus:border-blue-500 text-sm" placeholder="Pega tu token aquí..." />
              </div>
            ))}
            <button onClick={saveSettings} className={`w-full font-bold py-3 rounded-xl shadow-lg ${isSaved ? 'bg-green-600' : 'bg-blue-600'}`}>
              {isSaved ? "✅ Guardado" : "💾 Guardar Ajustes"}
            </button>
          </div>
        )}
      </main>

      {/* CONTROLES DE ESCRITURA INFERIORES */}
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
          <form onSubmit={handleSubmit} className="flex gap-2 w-full">
            <button type="button" onClick={() => fileInputRef.current.click()} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 w-[50px] rounded-xl flex justify-center items-center">📎</button>
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <input className="flex-1 bg-black border border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ej: Crea un video sobre vender casas..." />
            <button type="submit" disabled={(!input.trim() && attachments.length===0) || isLoading} className="bg-blue-600 disabled:bg-gray-800 w-[50px] rounded-xl font-bold text-white">➤</button>
          </form>
        </div>
      )}

      {/* MENÚ INFERIOR */}
      <nav className="fixed bottom-0 left-0 w-full bg-gray-950 border-t border-gray-800 flex justify-around p-2 z-20 h-[70px]">
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='chat'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">💬</span><span className="text-[9px] font-bold">CHAT</span></button>
        <button onClick={() => setActiveTab('factory')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='factory'?'text-cyan-500':'text-gray-500'}`}><span className="text-lg">📸</span><span className="text-[9px] font-bold">FÁBRICA</span></button>
        <button onClick={() => setActiveTab('studio')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='studio'?'text-red-500':'text-gray-500'}`}><span className="text-lg">🎬</span><span className="text-[9px] font-bold">ESTUDIO</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center p-1 w-16 ${activeTab==='settings'?'text-blue-500':'text-gray-500'}`}><span className="text-lg">⚙️</span><span className="text-[9px] font-bold">BÓVEDA</span></button>
      </nav>
    </div>
  );
}
