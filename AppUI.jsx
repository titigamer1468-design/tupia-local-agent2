import React, { useEffect, useRef, useState } from "react";
import {
  MODEL_VERSIONS,
  procesarConsultaIA
} from "./AIManager.js";
import { renderVideo } from "./VideoEngine.js";

// AppUI.jsx - INTEGRACIÓN CON n8n 🏭
const API_BASE = "https://vbkaf-13-140-25-193.run.pinggy-free.link";
const N8N_WEBHOOK = "http://13.140.25.193:5678/webhook-test/fabrica-modelslab"; // Tu nueva Fábrica

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error(`No se pudo leer el archivo ${file.name}`));

    reader.readAsDataURL(file);
  });

const readJsonResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      text || `Respuesta inválida del servidor. HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        data?.detalle ||
        `Error HTTP ${response.status}`
    );
  }

  return data;
};

const CodeBlock = ({ lang, code }) => {
  const safeCode = typeof code === "string" ? code.trim() : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeCode);
    } catch {
      alert("No se pudo copiar el código.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([safeCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `codigo.${lang || "txt"}`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-lg">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-xs font-bold text-gray-300">
        <span className="uppercase">{lang || "TEXTO"}</span>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="transition-colors hover:text-white"
          >
            📋 Copiar
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="transition-colors hover:text-white"
          >
            💾 Bajar
          </button>
        </div>
      </div>

      <pre className="overflow-x-auto p-4 font-mono text-xs text-green-400">
        <code>{safeCode}</code>
      </pre>
    </div>
  );
};

const getInitialChat = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title: "Nuevo Chat",
  messages: []
});

export default function AppUI() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("chat");
  const [logs, setLogs] = useState([]);

  const [activeModel, setActiveModel] = useState("openai");
  const [specificModel, setSpecificModel] = useState("gpt-5.6-luna");
  const [activePersona, setActivePersona] = useState("director");

  // ESTUDIO
  const [videoFiles, setVideoFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [directorPlan, setDirectorPlan] = useState(null);
  const [fontSize, setFontSize] = useState(90);
  const [textColor, setTextColor] = useState("#FF0050");
  const [videoFormat, setVideoFormat] = useState("vertical");
  const [engineMode, setEngineMode] = useState("vps");
  const [isRendering, setIsRendering] = useState(false);
  const [ffmpegLog, setFfmpegLog] = useState(
    "🎬 Motor 3D modular listo para generar."
  );
  const [videoResult, setVideoResult] = useState(null);

  // FÁBRICA
  const [factoryMode, setFactoryMode] = useState("image");
  const [factoryEngineMode, setFactoryEngineMode] = useState("vps");
  const [batchInput, setBatchInput] = useState("");
  const [factoryImage, setFactoryImage] = useState(null);

  const [isBatching, setIsBatching] = useState(false);
  const [batchStatus, setBatchStatus] = useState(
    "Esperando instrucciones..."
  );
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [zipUrl, setZipUrl] = useState(null);

  const [isSettingsSaved, setIsSettingsSaved] = useState(false);

  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const factoryImageInputRef = useRef(null);
  const studioUploadRef = useRef(null);
  const audioUploadRef = useRef(null);

  const addLog = (message) => {
    setLogs((previous) => [
      ...previous,
      `[${new Date().toLocaleTimeString()}] ${message}`
    ]);
  };

  const activeChat = chats.find((chat) => chat.id === currentChatId) || {
    messages: []
  };

  useEffect(() => {
    const savedChats = localStorage.getItem("tupia_chats");
    const savedCurrentChat = localStorage.getItem("tupia_current_chat");

    let parsedChats = [];

    try {
      parsedChats = savedChats ? JSON.parse(savedChats) : [];
    } catch {
      parsedChats = [];
    }

    if (Array.isArray(parsedChats) && parsedChats.length > 0) {
      setChats(parsedChats);
      setCurrentChatId(
        savedCurrentChat &&
          parsedChats.some((chat) => chat.id === savedCurrentChat)
          ? savedCurrentChat
          : parsedChats[0].id
      );
    } else {
      const newChat = getInitialChat();
      setChats([newChat]);
      setCurrentChatId(newChat.id);
    }

    addLog("[OK] Aplicación iniciada mediante Cloudflare.");
  }, []);

  useEffect(() => {
    try {
      if (chats.length > 0) {
        localStorage.setItem("tupia_chats", JSON.stringify(chats));
      }

      if (currentChatId) {
        localStorage.setItem("tupia_current_chat", currentChatId);
      }
    } catch (error) {
      console.warn("⚠️ No se pudo guardar el historial en LocalStorage. Posible límite de memoria alcanzado.", error);
    }
  }, [chats, currentChatId]);

  useEffect(() => {
    if (activeTab === "chat" && chatBottomRef.current) {
      try {
        chatBottomRef.current.scrollIntoView({
          behavior: "smooth"
        });
      } catch (error) {
        chatBottomRef.current.scrollIntoView();
      }
    }
  }, [chats, currentChatId, activeTab]);

  useEffect(() => {
    if (MODEL_VERSIONS[activeModel]?.length > 0) {
      setSpecificModel(MODEL_VERSIONS[activeModel][0].id);
    }
  }, [activeModel]);

  useEffect(() => {
    return () => {
      if (zipUrl) {
        URL.revokeObjectURL(zipUrl);
      }
    };
  }, [zipUrl]);

  const createNewChat = () => {
    const newChat = getInitialChat();

    setChats((previous) => [newChat, ...previous]);
    setCurrentChatId(newChat.id);
    setIsSidebarOpen(false);
    setActiveTab("chat");
  };

  const deleteChat = (chatId) => {
    if (!window.confirm("¿Seguro que quieres borrar este chat?")) {
      return;
    }

    const remainingChats = chats.filter((chat) => chat.id !== chatId);

    if (remainingChats.length === 0) {
      const newChat = getInitialChat();
      setChats([newChat]);
      setCurrentChatId(newChat.id);
      return;
    }

    setChats(remainingChats);

    if (currentChatId === chatId) {
      setCurrentChatId(remainingChats[0].id);
    }
  };

  const saveSettings = () => {
    setIsSettingsSaved(true);
    addLog("[INFO] Configuración visual guardada.");
    setTimeout(() => setIsSettingsSaved(false), 2000);
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    const newAttachments = [];

    try {
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          const data = await fileToBase64(file);

          newAttachments.push({
            type: "image",
            name: file.name,
            mime: file.type,
            data
          });
        } else {
          const text = await file.text();

          newAttachments.push({
            type: "text",
            name: file.name,
            data: text
          });
        }
      }

      setAttachments((previous) => [...previous, ...newAttachments]);
    } catch (error) {
      alert(error.message);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleStudioMedia = (event) => {
    const files = Array.from(event.target.files || []);

    const newFiles = files.map((file) => ({
      file,
      name: file.name,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }));

    setVideoFiles((previous) => [...previous, ...newFiles]);

    if (studioUploadRef.current) {
      studioUploadRef.current.value = "";
    }
  };

  const handleFactoryImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setFactoryImage(base64);
    } catch (error) {
      alert(error.message);
    }
  };

  const parseWorkflow = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const loadJSZip = async () => {
    if (window.JSZip) {
      return window.JSZip;
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.async = true;

      script.onload = resolve;
      script.onerror = () =>
        reject(new Error("No se pudo cargar el motor ZIP."));

      document.head.appendChild(script);
    });

    if (!window.JSZip) {
      throw new Error("JSZip no está disponible.");
    }

    return window.JSZip;
  };

  // 🔴 CONEXIÓN BLINDADA A n8n WEBHOOK
  const processFactoryTask = async (prompt, index) => {
    const promptTexto = typeof prompt === "object" ? JSON.stringify(prompt) : String(prompt);
    const numeroFormateado = String(index + 1).padStart(2, '0'); // Convierte "1" en "01"

    const response = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: promptTexto,
        tipo: factoryMode === "image" ? "imagen" : "video",
        numero_orden: numeroFormateado
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en n8n: ${response.status} - ${errText}`);
    }

    // n8n puede devolver JSON o texto dependiendo del último nodo
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      return { mensaje: "Procesado por n8n", detalle: text };
    }
  };

  const handleBatchGeneration = async () => {
    let promptList = [];

    try {
      const parsedInput = JSON.parse(batchInput);

      if (Array.isArray(parsedInput)) {
        promptList = parsedInput
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              return JSON.stringify(item);
            }
            return String(item);
          })
          .filter(Boolean);
      } else if (
        typeof parsedInput === "object" &&
        parsedInput !== null
      ) {
        promptList = [JSON.stringify(parsedInput)];
      } else {
        promptList = [String(parsedInput)];
      }
    } catch {
      promptList = batchInput
        .split("\n")
        .map((prompt) => prompt.trim())
        .filter(Boolean);
    }

    if (promptList.length === 0) {
      alert("Pega tus instrucciones primero.");
      return;
    }

    setIsBatching(true);
    setZipUrl(null);
    setBatchTotal(promptList.length);
    setBatchProgress(0);

    try {
      if (factoryEngineMode === "vps") {
        setBatchStatus(
          "☁️ Enviando lote a Cloudflare para procesamiento en segundo plano..."
        );

        const response = await fetch(`${API_BASE}/api/factory`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: "batch",
            promptList,
            factoryMode,
            imagen_base64: factoryImage
          })
        });

        const data = await readJsonResponse(response);

        setBatchProgress(promptList.length);
        setBatchStatus(
          `✅ ${
            data.message ||
            data.mensaje ||
            "El lote fue recibido por Cloudflare."
          }`
        );

        addLog("[OK] Lote enviado al Worker.");
        return;
      }

      setBatchStatus(
        `📱 Despachando tareas a n8n [${factoryMode.toUpperCase()}]...`
      );

      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const errors = [];
      let report = `=== REPORTE DE TAREAS n8n (${factoryMode.toUpperCase()}) ===\n\n`;

      for (let index = 0; index < promptList.length; index += 1) {
        const prompt = promptList[index];
        const taskNumber = index + 1;

        setBatchStatus(
          `Procesando orden ${taskNumber} de ${promptList.length} en n8n...`
        );

        let success = false;
        let lastError = "";

        for (let attempt = 1; attempt <= 3 && !success; attempt += 1) {
          try {
            const result = await processFactoryTask(prompt, index);

            if (!result || typeof result !== "object") {
              throw new Error("La fábrica n8n devolvió una respuesta inválida.");
            }

            const responseForReport = { ...result };
            const isVideo = factoryMode === "video";
            const targetFolder = isVideo ? "Videos_Generados" : "Imagenes_Generadas";

            // Si por algún milagro n8n devuelve el base64, lo zipeamos.
            if (result.archivo_base64) {
              const extension = result.extension || (isVideo ? "mp4" : "png");

              zip
                .folder(targetFolder)
                .file(
                  `Resultado_${taskNumber}.${extension}`,
                  result.archivo_base64,
                  { base64: true }
                );

              responseForReport.archivo_base64 =
                `✅ Archivo .${extension.toUpperCase()} guardado en el ZIP.`;
            } else if (result.imagen_base64) {
              zip
                .folder(targetFolder)
                .file(
                  `Resultado_${taskNumber}.png`,
                  result.imagen_base64,
                  { base64: true }
                );

              responseForReport.imagen_base64 =
                "✅ Imagen PNG guardada en el ZIP.";
            } else {
              // Si no, asumimos que n8n lo mandó a Google Drive con éxito
              responseForReport.estado = "✅ Tarea procesada y subida a Drive por n8n.";
            }

            report +=
              `Tarea ${taskNumber}:\n` +
              `Orden: ${String(prompt).slice(0, 120)}\n` +
              `Respuesta: ${JSON.stringify(responseForReport)}\n\n`;

            success = true;
          } catch (error) {
            lastError = error.message || "Error desconocido";

            if (attempt < 3) {
              setBatchStatus(
                `🔄 Reintentando envío a n8n (${attempt}/3)...`
              );

              await new Promise((resolve) => {
                setTimeout(resolve, 3000);
              });
            }
          }
        }

        if (!success) {
          errors.push(`Tarea ${taskNumber}: ${lastError}`);

          zip
            .folder("Errores")
            .file(
              `ERROR_${taskNumber}.txt`,
              `Error procesando la tarea en n8n.\n\nOrden:\n${String(prompt)}\n\nError:\n${lastError}`
            );
        }

        setBatchProgress(taskNumber);

        if (index < promptList.length - 1) {
          await new Promise((resolve) => {
            setTimeout(resolve, 1000); // Pausa entre peticiones para no saturar n8n
          });
        }
      }

      zip.file("Reporte_Fábrica.txt", report);

      setBatchStatus("📦 Empaquetando bitácora de resultados...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const generatedUrl = URL.createObjectURL(zipBlob);

      setZipUrl(generatedUrl);

      if (errors.length > 0) {
        setBatchStatus(
          `⚠️ Lote finalizado con ${errors.length} error(es). Revisa la bitácora ZIP.`
        );
      } else {
        setBatchStatus("✅ Lote enviado exitosamente a tu Drive.");
      }

      addLog("[OK] Lote procesado por n8n.");
    } catch (error) {
      console.error(error);
      setBatchStatus(`❌ Error de conexión: ${error.message}`);
      addLog(`[ERROR] Webhook: ${error.message}`);
    } finally {
      setIsBatching(false);
    }
  };

  const handleRenderProcess = async () => {
    if (videoFiles.length === 0) {
      alert("Sube imágenes al Estudio primero.");
      return;
    }

    setIsRendering(true);
    setVideoResult(null);
    setFfmpegLog("");

    try {
      if (engineMode === "local") {
        const url = await renderVideo({
          videoFiles,
          audioFile,
          directorPlan,
          fontSize,
          textColor,
          videoFormat,
          onLog: (message) => {
            setFfmpegLog((previous) => `${previous}\n${message}`);
          }
        });

        setVideoResult(url);
        return;
      }

      setFfmpegLog(
        "[INFO] 🌐 Preparando archivos para Cloudflare y VPS..."
      );

      const base64Videos = await Promise.all(
        videoFiles.map(({ file }) => fileToBase64(file))
      );

      const audioBase64 = audioFile
        ? await fileToBase64(audioFile)
        : null;

      const payload = {
        batchId: `lote_tupia_${Date.now()}`,
        videoFiles: base64Videos,
        audioUrl: audioBase64,
        directorPlan,
        fontSize: Number(fontSize),
        textColor,
        videoFormat
      };

      setFfmpegLog(
        "[INFO] 🚀 Enviando render al Worker de Cloudflare..."
      );

      const response = await fetch(`${API_BASE}/api/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await readJsonResponse(response);
      const resultUrl =
        data.downloadUrl ||
        data.url ||
        data.videoUrl ||
        data.resultUrl;

      if (!resultUrl) {
        throw new Error(
          "El servidor respondió correctamente, pero no devolvió una URL de descarga."
        );
      }

      setVideoResult(resultUrl);
      setFfmpegLog(
        "[INFO] ✅ El render fue completado correctamente."
      );
    } catch (error) {
      console.error(error);

      setFfmpegLog(
        (previous) =>
          `${previous}\n❌ ERROR: ${error?.message || "Error desconocido"}`
      );
    } finally {
      setIsRendering(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      (!input.trim() && attachments.length === 0) ||
      isLoading
    ) {
      return;
    }

    let finalInput = input.trim();

    const textFiles = attachments.filter(
      (attachment) => attachment.type === "text"
    );

    if (textFiles.length > 0) {
      finalInput +=
        "\n\n" +
        textFiles
          .map(
            (file) =>
              `--- ARCHIVO: ${file.name} ---\n` +
              `${file.data}\n` +
              `--- FIN DE ARCHIVO ---`
          )
          .join("\n\n");
    }

    const images = attachments.filter(
      (attachment) => attachment.type === "image"
    );

    const displayUserText =
      input.trim() +
      (attachments.length > 0
        ? `\n[+ ${attachments.length} archivo(s) adjunto(s)]`
        : "");

    const userMessage = {
      role: "user",
      content: displayUserText,
      rawContent: finalInput
    };

    const newMessages = [
      ...activeChat.messages,
      userMessage
    ];

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              title:
                chat.messages.length === 0
                  ? (input.trim() || "Chat con archivo").slice(0, 40)
                  : chat.title,
              messages: newMessages
            }
          : chat
      )
    );

    setInput("");
    setAttachments([]);
    setIsLoading(true);

    addLog(
      `Consultando ${activePersona.toUpperCase()} mediante Cloudflare...`
    );

    try {
      const history = newMessages
        .slice(-5)
        .map((message) => ({
          role: message.role,
          content: message.rawContent || message.content
        }));

      const result = await procesarConsultaIA({
        activeModel,
        specificModel,
        activePersona,
        finalInput,
        history,
        images
      });

      const uiReply =
        result?.uiReply ||
        result?.reply ||
        result?.content ||
        "El Worker no devolvió contenido.";

      const planExtraido = result?.directorPlan || null;

      if (planExtraido) {
        setDirectorPlan(planExtraido);
      }

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [
                  ...newMessages,
                  {
                    role: "assistant",
                    content: uiReply
                  }
                ]
              }
            : chat
        )
      );

      addLog("[OK] Respuesta recibida del Worker.");
    } catch (error) {
      const errorMessage = `❌ Error: ${
        error?.message || "No se pudo procesar la consulta."
      }`;

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [
                  ...newMessages,
                  {
                    role: "assistant",
                    content: errorMessage
                  }
                ]
              }
            : chat
        )
      );

      addLog(`[ERROR] IA: ${error?.message || "Error desconocido"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (text) => {
    if (typeof text !== "string") {
      return <p>Archivo procesado.</p>;
    }

    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (
        part.startsWith("```") &&
        part.endsWith("```")
      ) {
        const match = part.match(
          /```([^\n]*)\n([\s\S]*?)```/
        );

        if (match) {
          return (
            <CodeBlock
              key={index}
              lang={match[1] || "txt"}
              code={match[2]}
            />
          );
        }

        return (
          <CodeBlock
            key={index}
            lang="txt"
            code={part.slice(3, -3)}
          />
        );
      }

      if (!part) {
        return null;
      }

      return (
        <p
          key={index}
          className="whitespace-pre-wrap leading-relaxed"
        >
          {part}
        </p>
      );
    });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black font-sans text-white">
      <header className="z-10 flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded px-2 text-2xl text-gray-300 transition hover:bg-gray-800 hover:text-white"
          >
            ☰
          </button>

          <h1 className="text-lg font-bold tracking-tight text-blue-400">
            Tupia Workspace
          </h1>
        </div>

        <button
          type="button"
          onClick={createNewChat}
          className="rounded-full border border-blue-800/50 bg-blue-600/30 px-3 py-1 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-600 hover:text-white"
        >
          ➕ Nuevo
        </button>
      </header>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/80">
          <div className="flex h-full w-4/5 max-w-sm flex-col border-r border-gray-800 bg-gray-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 p-4">
              <h2 className="text-lg font-bold text-white">
                Tus Chats
              </h2>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="text-3xl text-gray-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded-lg p-3 transition-all ${
                    chat.id === currentChatId
                      ? "border border-blue-500/50 bg-blue-900/40 text-blue-300"
                      : "text-gray-400 hover:bg-gray-900"
                  }`}
                >
                  <span className="flex-1 truncate text-sm font-medium">
                    {chat.title}
                  </span>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="ml-2 p-1 text-gray-600 hover:text-red-400"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex-1"
            onClick={() => setIsSidebarOpen(false)}
          />
        </div>
      )}

      <main className="relative flex-1 overflow-y-auto pb-48">
        {activeTab === "chat" && (
          <div className="space-y-4 p-4">
            {activeChat.messages.length === 0 && (
              <div className="mt-10 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500">
                <span className="mb-4 block text-5xl">🧩</span>

                <p className="font-bold text-gray-300">
                  El Método PTB + Editor
                </p>

                <p className="mt-2 text-sm">
                  Usa Plan 🗺️ ➔ Think 🤔 ➔ Build 🏗️
                  <br />
                  o cambia al Director de Cine 🎬
                </p>

                <p className="mt-4 text-xs text-cyan-400">
                  Conectado mediante Cloudflare Worker
                </p>
              </div>
            )}

            {activeChat.messages.map((message, index) => (
              <div
                key={`${currentChatId}-${index}`}
                className={`flex ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-4 text-sm shadow-md ${
                    message.role === "user"
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "w-full rounded-bl-sm border border-gray-700 bg-gray-900 text-gray-100"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="mb-3 flex items-center justify-between border-b border-gray-700/50 pb-2">
                      <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                        🤖 Tupia AI
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(message.content);
                          } catch (err) {
                            alert("Copiado manual requerido en este navegador.");
                          }
                        }}
                        className="rounded bg-gray-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-white"
                      >
                        📋 Copiar Todo
                      </button>
                    </div>
                  )}

                  {message.role === "user" ? (
                    <p className="whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : (
                    renderMessageContent(message.content)
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="w-1/2 animate-pulse rounded-xl bg-gray-800 p-3 text-sm">
                Pensando mediante Cloudflare...
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}

        {activeTab === "factory" && (
          <div className="space-y-6 p-6">
            <h2 className="flex items-center justify-between border-b border-gray-800 pb-2 text-xl font-bold text-cyan-400">
              <span>🏭 Súper Fábrica</span>

              <select
                value={factoryEngineMode}
                onChange={(event) =>
                  setFactoryEngineMode(event.target.value)
                }
                className="rounded-lg border border-gray-700 bg-gray-900 p-1 text-xs font-normal text-white"
              >
                <option value="celular">
                  📱 Procesar lote directo a n8n
                </option>
                <option value="vps">
                  ☁️ Cloudflare / VPS 24/7
                </option>
              </select>
            </h2>

            <div className="flex rounded-xl border border-gray-800 bg-gray-950 p-1 shadow-lg">
              <button
                type="button"
                onClick={() => setFactoryMode("image")}
                className={`flex-1 rounded-lg py-3 text-xs font-bold transition-colors ${
                  factoryMode === "image"
                    ? "bg-cyan-600 text-white"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                📸 Imagen
              </button>

              <button
                type="button"
                onClick={() => setFactoryMode("video")}
                className={`flex-1 rounded-lg py-3 text-xs font-bold transition-colors ${
                  factoryMode === "video"
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                🎥 Video
              </button>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Instrucciones o JSON para la fábrica
              </label>

              <textarea
                value={batchInput}
                onChange={(event) =>
                  setBatchInput(event.target.value)
                }
                className={`h-64 w-full resize-none rounded-lg border border-gray-700 bg-black p-3 font-mono text-sm outline-none ${
                  factoryMode === "image"
                    ? "text-cyan-400 focus:border-cyan-500"
                    : "text-purple-400 focus:border-purple-500"
                }`}
                placeholder={`Pega aquí la lista de prompts que quieres procesar...`}
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  ref={factoryImageInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFactoryImageChange}
                />

                <button
                  type="button"
                  onClick={() =>
                    factoryImageInputRef.current?.click()
                  }
                  className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-xs text-gray-300 transition-colors hover:text-white"
                >
                  {factoryImage
                    ? "✅ Imagen cargada"
                    : "📸 Adjuntar imagen opcional"}
                </button>

                {factoryImage && (
                  <button
                    type="button"
                    onClick={() => setFactoryImage(null)}
                    className="text-xs font-bold text-red-400"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <p className="mt-3 text-xs text-gray-400">
                {factoryEngineMode === "vps"
                  ? "☁️ El lote se envía al Worker de Cloudflare."
                  : "📱 El lote se envía 1x1 directamente a tu Webhook local de n8n."}
              </p>
            </div>

            {isBatching && (
              <div className="rounded-xl border border-cyan-800/50 bg-gray-950 p-4 text-center">
                <p className="mb-2 text-sm font-bold text-cyan-400">
                  {batchStatus}
                </p>

                {factoryEngineMode === "celular" && (
                  <>
                    <div className="mb-2 h-4 w-full overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={`h-4 transition-all duration-300 ${
                          factoryMode === "image"
                            ? "bg-cyan-500"
                            : "bg-purple-500"
                        }`}
                        style={{
                          width:
                            batchTotal > 0
                              ? `${(batchProgress / batchTotal) * 100}%`
                              : "0%"
                        }}
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      {batchProgress} de {batchTotal} tareas despachadas a n8n
                    </p>
                  </>
                )}
              </div>
            )}

            {!isBatching && (
              <button
                type="button"
                onClick={handleBatchGeneration}
                className={`w-full rounded-xl bg-gradient-to-r py-4 font-bold text-white shadow-lg transition-all ${
                  factoryMode === "image"
                    ? "from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                    : "from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                }`}
              >
                {factoryEngineMode === "vps"
                  ? "🚀 Enviar lote a Cloudflare"
                  : "🚀 Despachar Lote a n8n Local"}
              </button>
            )}

            {!isBatching && batchStatus !== "Esperando instrucciones..." && (
              <div
                className={`rounded-xl border p-4 text-center text-sm ${
                  batchStatus.startsWith("❌")
                    ? "border-red-500/50 bg-red-900/30 text-red-400"
                    : batchStatus.startsWith("⚠️")
                    ? "border-yellow-500/50 bg-yellow-900/30 text-yellow-400"
                    : "border-green-500/50 bg-green-900/30 text-green-400"
                }`}
              >
                {batchStatus}
              </div>
            )}

            {zipUrl && (
              <div className="rounded-xl border border-green-500 bg-gray-900 p-4 text-center shadow-2xl shadow-green-500/20">
                <h3 className="mb-3 text-base font-bold text-green-400">
                  ✅ Bitácora ZIP generada
                </h3>

                <p className="mb-4 text-xs text-gray-400">
                  Tus archivos ya deberían estar en Google Drive. El ZIP contiene el reporte de n8n.
                </p>

                <a
                  href={zipUrl}
                  download={`Reporte_n8n_${factoryMode}_${Date.now()}.zip`}
                  className="block w-full rounded-xl bg-green-600 py-4 font-bold text-white transition-colors hover:bg-green-500"
                >
                  📥 Descargar Reporte ZIP
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === "studio" && (
          <div className="space-y-6 p-6">
            <h2 className="flex items-center justify-between border-b border-gray-800 pb-2 text-xl font-bold text-red-400">
              <span>🎬 Tupia Director</span>

              <select
                value={engineMode}
                onChange={(event) =>
                  setEngineMode(event.target.value)
                }
                className="rounded-lg border border-gray-700 bg-gray-900 p-1 text-xs text-white"
              >
                <option value="local">
                  ⚙️ Procesar localmente
                </option>

                <option value="vps">
                  ☁️ Enviar a Cloudflare / VPS
                </option>
              </select>
            </h2>

            {directorPlan && (
              <div className="rounded-xl border border-blue-500/50 bg-blue-900/30 p-4">
                <span className="text-sm font-bold text-blue-300">
                  🧠 Plan Director activo:{" "}
                  {Array.isArray(directorPlan)
                    ? directorPlan.length
                    : Object.keys(directorPlan || {}).length}{" "}
                  escenas
                </span>

                <p className="mt-1 text-xs text-gray-400">
                  Los textos de la IA están listos para estamparse.
                </p>
              </div>
            )}

            <div className="flex rounded-xl border border-gray-800 bg-gray-950 p-1">
              <button
                type="button"
                onClick={() => setVideoFormat("horizontal")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                  videoFormat === "horizontal"
                    ? "bg-red-600 text-white"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                🖥️ Horizontal 16:9
              </button>

              <button
                type="button"
                onClick={() => setVideoFormat("vertical")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                  videoFormat === "vertical"
                    ? "bg-red-600 text-white"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                📱 Vertical 9:16
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-800 bg-gray-950 p-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-400">
                  Tamaño del texto ({fontSize}px)
                </label>

                <input
                  type="range"
                  min="40"
                  max="150"
                  value={fontSize}
                  onChange={(event) =>
                    setFontSize(Number(event.target.value))
                  }
                  className="w-full accent-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-gray-400">
                  Color del texto
                </label>

                <input
                  type="color"
                  value={textColor}
                  onChange={(event) =>
                    setTextColor(event.target.value)
                  }
                  className="h-8 w-full cursor-pointer rounded border-none"
                />
              </div>
            </div>

            <div className="flex w-full gap-4">
              <button
                type="button"
                onClick={() => studioUploadRef.current?.click()}
                className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-800 bg-gray-900 p-4 hover:border-red-500/40"
              >
                <span className="mb-2 text-4xl">🎞️</span>
                <span className="text-sm font-bold text-gray-300">
                  Imágenes
                </span>
              </button>

              <input
                ref={studioUploadRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*"
                onChange={handleStudioMedia}
              />

              <button
                type="button"
                onClick={() => audioUploadRef.current?.click()}
                className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-800 bg-gray-900 p-4 hover:border-blue-500/40"
              >
                <span className="mb-2 text-4xl">🎵</span>
                <span className="text-sm font-bold text-gray-300">
                  {audioFile ? "Pista lista" : "Música de fondo"}
                </span>
              </button>

              <input
                ref={audioUploadRef}
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={(event) =>
                  setAudioFile(event.target.files?.[0] || null)
                }
              />
            </div>

            {audioFile && (
              <button
                type="button"
                onClick={() => {
                  setAudioFile(null);

                  if (audioUploadRef.current) {
                    audioUploadRef.current.value = "";
                  }
                }}
                className="text-xs font-bold text-red-400"
              >
                Quitar música: {audioFile.name}
              </button>
            )}

            {videoFiles.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                <p className="mb-2 text-xs font-bold text-gray-400">
                  Secuencia visual ({videoFiles.length} imágenes)
                </p>

                <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
                  {videoFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex rounded-lg border border-gray-800 bg-gray-900 p-2 text-xs"
                    >
                      <span className="flex-1 truncate text-gray-300">
                        {item.name}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setVideoFiles((previous) =>
                            previous.filter(
                              (video) => video.id !== item.id
                            )
                          )
                        }
                        className="ml-2 text-red-500"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleRenderProcess}
              disabled={isRendering || videoFiles.length === 0}
              className={`w-full rounded-xl py-4 font-bold shadow-lg ${
                isRendering
                  ? "animate-pulse bg-amber-600"
                  : "bg-gradient-to-r from-red-600 to-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              {isRendering
                ? "⚙️ Renderizando..."
                : `🎬 Renderizar en ${
                    engineMode === "local" ? "LOCAL" : "CLOUD"
                  }`}
            </button>

            {videoResult && (
              <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-2xl shadow-red-500/20">
                <h3 className="mb-3 text-sm font-bold text-green-400">
                  ✅ Video generado
                </h3>

                <video
                  src={videoResult}
                  controls
                  className={`w-full rounded-lg bg-black ${
                    videoFormat === "horizontal"
                      ? "aspect-video"
                      : "aspect-[9/16]"
                  }`}
                />

                <a
                  href={videoResult}
                  download={`Tupia_Director_${videoFormat}.mp4`}
                  className="mt-4 block w-full rounded-xl bg-green-600 py-3 text-center font-bold transition-colors hover:bg-green-500"
                >
                  💾 Descargar MP4
                </a>
              </div>
            )}

            <div className="h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-800 bg-black p-4 font-mono text-xs text-red-400">
              {ffmpegLog}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4 p-6">
            <h2 className="border-b border-gray-800 pb-2 text-xl font-bold">
              ⚙️ Configuración
            </h2>

            <div className="rounded-xl border border-cyan-800/50 bg-gray-900 p-4">
              <h3 className="font-bold text-cyan-400">
                ☁️ Cloudflare Worker activo
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                Las API Keys, el Webhook de Modal y la URL del VPS ya no se
                almacenan en este navegador. El Worker administra estas
                credenciales mediante secretos de Cloudflare.
              </p>

              <div className="mt-4 rounded-lg border border-green-800/50 bg-green-950/30 p-3 text-xs text-green-400">
                ✅ Credenciales protegidas en el servidor
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h3 className="font-bold text-purple-400">
                🧩 Preferencias de interfaz
              </h3>

              <p className="mt-2 text-xs text-gray-400">
                Los chats se guardan localmente en este navegador. Las
                solicitudes de IA, fábrica y render pasan por Cloudflare.
              </p>

              <div className="mt-4 space-y-2 text-xs text-gray-500">
                <p>• Endpoint IA: /api/ai</p>
                <p>• Endpoint Fábrica: /api/factory</p>
                <p>• Endpoint Render: /api/render</p>
              </div>
            </div>

            <button
              type="button"
              onClick={saveSettings}
              className={`w-full rounded-xl py-3 font-bold shadow-lg ${
                isSettingsSaved ? "bg-green-600" : "bg-blue-600"
              }`}
            >
              {isSettingsSaved
                ? "✅ Configuración guardada"
                : "💾 Guardar preferencias"}
            </button>

            {logs.length > 0 && (
              <details className="rounded-xl border border-gray-800 bg-black p-3">
                <summary className="cursor-pointer text-xs font-bold text-gray-400">
                  Ver registro local
                </summary>

                <div className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-gray-500">
                  {logs.join("\n")}
                </div>
              </details>
            )}
          </div>
        )}
      </main>

      {activeTab === "chat" && (
        <div className="fixed bottom-[70px] left-0 z-10 flex w-full flex-col gap-2 border-t border-gray-800 bg-gray-900 p-2 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          <div className="grid grid-cols-3 gap-1">
            <select
              value={activeModel}
              onChange={(event) =>
                setActiveModel(event.target.value)
              }
              className="rounded-lg border border-gray-700 bg-black p-2 text-[10px] font-bold text-blue-400 outline-none md:text-xs"
            >
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="alibaba">Alibaba</option>
              <option value="nvidia">Nvidia</option>
              <option value="multimedia">📸 Generar Imagen / Voz</option>
            </select>

            <select
              value={specificModel}
              onChange={(event) =>
                setSpecificModel(event.target.value)
              }
              className="rounded-lg border border-gray-700 bg-black p-2 text-[10px] font-bold text-green-400 outline-none md:text-xs"
            >
              {MODEL_VERSIONS[activeModel]?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>

            <select
              value={activePersona}
              onChange={(event) =>
                setActivePersona(event.target.value)
              }
              className="rounded-lg border border-gray-700 bg-black p-2 text-[10px] font-bold text-purple-400 outline-none md:text-xs"
            >
              <option value="default">🗣️ Normal</option>
              <option value="director">🎬 Director</option>
              <option value="plan">🗺️ Plan</option>
              <option value="think">🤔 Think</option>
              <option value="build">🏗️ Build</option>
              <option value="youtube">▶️ YouTube</option>
              <option value="infoproducto">📦 Venta</option>
            </select>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex w-full gap-2"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-[50px] items-center justify-center rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700"
            >
              📎
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.txt,.js,.jsx,.ts,.tsx,.json,.css,.html,.md"
              onChange={handleFileChange}
            />

            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="flex-1 rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="Escribe tu solicitud..."
            />

            <button
              type="submit"
              disabled={
                (!input.trim() && attachments.length === 0) ||
                isLoading
              }
              className="w-[50px] rounded-xl bg-blue-600 font-bold text-white disabled:bg-gray-800"
            >
              ➤
            </button>
          </form>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 z-20 flex h-[70px] w-full justify-around border-t border-gray-800 bg-gray-950 p-2">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex w-16 flex-col items-center p-1 ${
            activeTab === "chat"
              ? "text-blue-500"
              : "text-gray-500"
          }`}
        >
          <span className="text-lg">💬</span>
          <span className="text-[9px] font-bold">CHAT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("factory")}
          className={`flex w-16 flex-col items-center p-1 ${
            activeTab === "factory"
              ? "text-cyan-500"
              : "text-gray-500"
          }`}
        >
          <span className="text-lg">📸</span>
          <span className="text-[9px] font-bold">FÁBRICA</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("studio")}
          className={`flex w-16 flex-col items-center p-1 ${
            activeTab === "studio"
              ? "text-red-500"
              : "text-gray-500"
          }`}
        >
          <span className="text-lg">🎬</span>
          <span className="text-[9px] font-bold">ESTUDIO</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex w-16 flex-col items-center p-1 ${
            activeTab === "settings"
              ? "text-blue-500"
              : "text-gray-500"
          }`}
        >
          <span className="text-lg">⚙️</span>
          <span className="text-[9px] font-bold">AJUSTES</span>
        </button>
      </nav>
    </div>
  );
}