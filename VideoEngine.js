// =================================================================
// 🎬 VideoEngine.js - MOTOR DE RENDERIZADO 3D (FFMPEG + CANVAS)
// =================================================================

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance = null;
let activeRender = null;
let isRendering = false;
let renderSequence = 0;

/**
 * Detecta si la aplicación se está ejecutando dentro de Capacitor
 * sin importar @capacitor/core.
 */
const isNativeRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const protocol = window.location?.protocol;

  const capacitorGlobal =
    globalThis?.Capacitor ||
    window.Capacitor;

  return (
    protocol === "file:" ||
    protocol === "capacitor:" ||
    capacitorGlobal?.isNativePlatform?.() === true
  );
};

/**
 * 🛑 Cancela el renderizado en curso
 */
export const cancelRender = async () => {
  renderSequence++;

  const render = activeRender;

  if (!render) {
    return;
  }

  render.cancelled = true;
  ffmpegInstance = null;

  if (render.ffmpeg) {
    try {
      await render.ffmpeg.terminate();
    } catch {
      // El Worker puede haber terminado previamente.
    }
  }

  if (render.renderStopped) {
    await render.renderStopped;
  }
};

/**
 * 🖼️ Generador de capas adaptativo
 */
export const createFrame = (
  file,
  textOverlay,
  fontSize = 72,
  textColor = "#ffffff",
  format = "horizontal"
) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        if (!img.width || !img.height) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        const canvas = document.createElement("canvas");
        const isVertical = format === "vertical";

        const targetW = isVertical ? 1080 : 1920;
        const targetH = isVertical ? 1920 : 1080;

        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext("2d", {
          alpha: false
        });

        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, targetW, targetH);

        const scale = Math.max(
          targetW / img.width,
          targetH / img.height
        );

        const drawW = img.width * scale;
        const drawH = img.height * scale;

        const drawX = (targetW - drawW) / 2;
        const drawY = (targetH - drawH) / 2;

        ctx.drawImage(
          img,
          drawX,
          drawY,
          drawW,
          drawH
        );

        const cleanText = String(textOverlay || "")
          .replace(/\\n/g, "\n")
          .trim();

        if (cleanText) {
          const safeFontSize = Math.max(
            24,
            Number(fontSize) || 72
          );

          const lines = cleanText
            .split(/\r?\n/)
            .filter(Boolean);

          ctx.font =
            `900 ${safeFontSize}px Impact, Arial Black, sans-serif`;

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.lineWidth = Math.max(
            5,
            safeFontSize * 0.1
          );

          ctx.strokeStyle = "#000000";
          ctx.fillStyle = textColor || "#ffffff";

          ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
          ctx.shadowBlur = 18;
          ctx.shadowOffsetX = 4;
          ctx.shadowOffsetY = 4;

          const lineHeight = safeFontSize + 20;
          const totalHeight = lines.length * lineHeight;

          const firstY =
            targetH / 2 -
            totalHeight / 2 +
            lineHeight / 2;

          lines.forEach((line, index) => {
            const y = firstY + index * lineHeight;
            const safeLine = line.slice(0, 180);

            ctx.strokeText(
              safeLine,
              targetW / 2,
              y
            );

            ctx.fillText(
              safeLine,
              targetW / 2,
              y
            );
          });

          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob || null);
          },
          "image/jpeg",
          0.92
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
};

const safeLog = (onLog, message) => {
  if (typeof onLog === "function") {
    onLog(message);
  } else {
    console.log(message);
  }
};

const deleteFileSafe = async (ffmpeg, filename) => {
  try {
    await ffmpeg.deleteFile(filename);
  } catch {
    // El archivo puede no existir.
  }
};

const cleanFFmpegFiles = async (ffmpeg, count) => {
  await deleteFileSafe(ffmpeg, "output.mp4");
  await deleteFileSafe(ffmpeg, "audio.mp3");

  for (let i = 0; i < count; i++) {
    await deleteFileSafe(ffmpeg, `img${i}.jpg`);
  }
};

const getVideoDimensions = (videoFormat) => {
  if (videoFormat === "vertical") {
    return {
      width: 1080,
      height: 1920
    };
  }

  return {
    width: 1920,
    height: 1080
  };
};

const getEffectForScene = (directorPlan, index) => {
  const allowedEffects = [
    "zoom_in_3d",
    "zoom_out_3d",
    "pan_right",
    "pan_left",
    "wind_float",
    "wave_float"
  ];

  const requestedEffect =
    directorPlan?.[index]?.efecto_camara;

  if (allowedEffects.includes(requestedEffect)) {
    return requestedEffect;
  }

  return allowedEffects[index % allowedEffects.length];
};

/**
 * 🎬 Orquestador principal FFmpeg
 */
export async function renderVideo({
  videoFiles = [],
  audioFile = null,
  directorPlan = [],
  fontSize = 72,
  textColor = "#ffffff",
  videoFormat = "horizontal",
  onLog
}) {
  const log = (message) => safeLog(onLog, message);

  if (isRendering) {
    throw new Error(
      "Ya existe un renderizado en curso."
    );
  }

  if (!Array.isArray(videoFiles) || videoFiles.length === 0) {
    throw new Error(
      "Debes seleccionar al menos una imagen."
    );
  }

  isRendering = true;

  const currentRenderId = ++renderSequence;
  let ffmpeg = null;

  const renderState = {
    ffmpeg: null,
    cancelled: false,
    renderStopped: null
  };

  let resolveRenderStop;

  renderState.renderStopped = new Promise((resolve) => {
    resolveRenderStop = resolve;
  });

  activeRender = renderState;

  const isRenderCancelled = () =>
    currentRenderId !== renderSequence ||
    renderState.cancelled;

  try {
    log(
      "[INFO] ⚡ Inicializando Tupia Video Engine local..."
    );

    ffmpeg = ffmpegInstance;

    if (!ffmpeg) {
      log(
        "[INFO] 📥 Descargando Motor de Video FFmpeg WebAssembly..."
      );

      ffmpeg = new FFmpeg();

      // Registramos el Worker inmediatamente para permitir cancelarlo.
      renderState.ffmpeg = ffmpeg;

      ffmpeg.on("log", ({ message }) => {
        if (
          message.includes("frame=") ||
          message.includes("fps=") ||
          message.includes("time=")
        ) {
          log(`[PROGRESO] ⚙️ ${message}`);
        }
      });

      const runningInsideNativeApp =
        isNativeRuntime();

      if (runningInsideNativeApp) {
        log(
          "[INFO] 📱 Entorno App detectado: ensamblando FFmpeg en memoria..."
        );

        const [resJs, resA, resB] = await Promise.all([
          fetch("./ffmpeg-core.js"),
          fetch("./ffmpeg-core.wasm.partaa"),
          fetch("./ffmpeg-core.wasm.partab")
        ]);

        if (!resJs.ok || !resA.ok || !resB.ok) {
          throw new Error(
            "No se encontraron los binarios FFmpeg empaquetados en /public."
          );
        }

        const jsBuffer = await resJs.arrayBuffer();
        const wasmA = await resA.arrayBuffer();
        const wasmB = await resB.arrayBuffer();

        const wasmBytes = new Uint8Array(
          wasmA.byteLength + wasmB.byteLength
        );

        wasmBytes.set(
          new Uint8Array(wasmA),
          0
        );

        wasmBytes.set(
          new Uint8Array(wasmB),
          wasmA.byteLength
        );

        const coreURL = URL.createObjectURL(
          new Blob(
            [jsBuffer],
            {
              type: "text/javascript"
            }
          )
        );

        const wasmURL = URL.createObjectURL(
          new Blob(
            [wasmBytes],
            {
              type: "application/wasm"
            }
          )
        );

        try {
          await ffmpeg.load({
            coreURL,
            wasmURL
          });
        } finally {
          URL.revokeObjectURL(coreURL);
          URL.revokeObjectURL(wasmURL);
        }
      } else {
        log(
          "[INFO] 🌐 Entorno Web detectado: cargando FFmpeg remoto..."
        );

        const baseURL =
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

        const coreURL = await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        );

        const wasmURL = await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        );

        await ffmpeg.load({
          coreURL,
          wasmURL
        });
      }

      if (isRenderCancelled()) {
        throw new Error(
          "El renderizado fue cancelado."
        );
      }

      ffmpegInstance = ffmpeg;

      log(
        "[INFO] ✅ Motor de Video cargado en memoria RAM."
      );
    } else {
      renderState.ffmpeg = ffmpeg;

      log(
        "[INFO] ♻️ Reutilizando motor FFmpeg ya cargado."
      );
    }

    if (isRenderCancelled()) {
      throw new Error(
        "El renderizado fue cancelado."
      );
    }

    try {
      await cleanFFmpegFiles(
        ffmpeg,
        videoFiles.length
      );
    } catch {
      ffmpegInstance = null;

      throw new Error(
        "La instancia almacenada de FFmpeg no es válida."
      );
    }

    if (isRenderCancelled()) {
      throw new Error(
        "El renderizado fue cancelado."
      );
    }

    log(
      `[INFO] ✍️ Preparando ${videoFiles.length} fotogramas...`
    );

    const normalizedFormat =
      videoFormat === "vertical"
        ? "vertical"
        : "horizontal";

    for (let i = 0; i < videoFiles.length; i++) {
      if (isRenderCancelled()) {
        throw new Error(
          "El renderizado fue cancelado."
        );
      }

      const textoIA =
        directorPlan?.[i]?.texto_pantalla || null;

      const file =
        videoFiles[i]?.file ||
        videoFiles[i];

      const jpgBlob = await createFrame(
        file,
        textoIA,
        fontSize,
        textColor,
        normalizedFormat
      );

      if (!jpgBlob) {
        throw new Error(
          `No se pudo procesar la imagen ${i + 1}.`
        );
      }

      await ffmpeg.writeFile(
        `img${i}.jpg`,
        await fetchFile(jpgBlob)
      );

      if (isRenderCancelled()) {
        throw new Error(
          "El renderizado fue cancelado."
        );
      }
    }

    if (audioFile) {
      log("[INFO] 🎵 Subiendo pista de audio...");

      await ffmpeg.writeFile(
        "audio.mp3",
        await fetchFile(audioFile)
      );

      if (isRenderCancelled()) {
        throw new Error(
          "El renderizado fue cancelado."
        );
      }
    }

    log(
      "[INFO] 🎥 Ensamblando Secuencia de Video Inteligente..."
    );

    const {
      width: targetW,
      height: targetH
    } = getVideoDimensions(normalizedFormat);

    const ffmpegArgs = [];
    let filterComplex = "";
    let duracionTotal = 0;

    const fadeDur = 1.0;
    const fps = 30;

    for (let i = 0; i < videoFiles.length; i++) {
      const efectoAplicar =
        getEffectForScene(directorPlan, i);

      const rawDuration =
        directorPlan?.[i]?.duracion;

      const baseDur = Math.max(
        1,
        Number(rawDuration) || 5
      );

      const fileDur = baseDur + fadeDur;

      ffmpegArgs.push(
        "-loop",
        "1",
        "-framerate",
        `${fps}`,
        "-t",
        `${fileDur}`,
        "-i",
        `img${i}.jpg`
      );

      duracionTotal += baseDur;

      let zoomPanStr = "";

      if (efectoAplicar === "zoom_in_3d") {
        zoomPanStr =
          `zoompan=` +
          `z='min(1+on*0.0015,1.5)'` +
          `:d=1` +
          `:x='iw/2-(iw/zoom/2)'` +
          `:y='ih/2-(ih/zoom/2)'` +
          `:s=${targetW}x${targetH}` +
          `:fps=${fps}`;
      } else if (efectoAplicar === "wind_float") {
        zoomPanStr =
          `zoompan=` +
          `z='1.1'` +
          `:d=1` +
          `:x='iw/2-(iw/zoom/2)+15*sin(on/15)'` +
          `:y='ih/2-(ih/zoom/2)+15*cos(on/15)'` +
          `:s=${targetW}x${targetH}` +
          `:fps=${fps}`;
      } else if (efectoAplicar === "pan_right") {
        zoomPanStr =
          `zoompan=` +
          `z='1.15'` +
          `:d=1` +
          `:x='iw/2-(iw/zoom/2)+on*0.5'` +
          `:y='ih/2-(ih/zoom/2)'` +
          `:s=${targetW}x${targetH}` +
          `:fps=${fps}`;
      } else if (efectoAplicar === "pan_left") {
        zoomPanStr =
          `zoompan=` +
          `z='1.15'` +
          `:d=1` +
          `:x='iw/2-(iw/zoom/2)-on*0.5'` +
          `:y='ih/2-(ih/zoom/2)'` +
          `:s=${targetW}x${targetH}` +
          `:fps=${fps}`;
      } else if (efectoAplicar === "wave_float") {
        zoomPanStr =
          `zoompan=` +
          `z='min(1.1+on*0.001,1.3)'` +
          `:d=1` +
          `:x='iw/2-(iw/zoom/2)+20*sin(on/20)'` +
          `:y='ih/2-(ih/zoom/2)+20*cos(on/15)'` +
          `:s=${targetW}x${targetH}` +
          `:fps=${fps}`;
      } else if (efectoAplicar === "zoom_out_3d") {
        zoomPanStr =
          `zoompan=` +
          `z='max(1.5-on*0.0015,1.0)'` +
          `:d=1` +
          `:x='iw/2-(iw/zoom/2)'` +
          `:y='ih/2-(ih/zoom/2)'` +
          `:s=${targetW}x${targetH}` +
          `:fps=${fps}`;
      } else {
        zoomPanStr =
          `zoompan=` +
          `z='min(1+on*0.001,1.5)'` +
          `:d=1` +
          `:x='iw/2-(iw/zoom/2)'` +
          `:y='ih/2-(ih/zoom/2)'` +
          `:s=${targetW}x${targetH}` +
          `:fps=${fps}`;
      }

      filterComplex +=
        `[${i}:v]${zoomPanStr},` +
        `fps=${fps},` +
        `settb=AVTB,` +
        `setsar=1,` +
        `format=yuv420p` +
        `[v${i}];`;
    }

    if (audioFile) {
      ffmpegArgs.push(
        "-stream_loop",
        "-1",
        "-i",
        "audio.mp3"
      );
    }

    if (videoFiles.length > 1) {
      let lastNode = "[v0]";
      let currentOffset = 0;

      for (let i = 1; i < videoFiles.length; i++) {
        const previousDuration = Math.max(
          1,
          Number(
            directorPlan?.[i - 1]?.duracion
          ) || 5
        );

        currentOffset += previousDuration;

        const isLast =
          i === videoFiles.length - 1;

        const nextNode = isLast
          ? "[outv]"
          : `[xf${i}]`;

        filterComplex +=
          `${lastNode}[v${i}]` +
          `xfade=transition=fade:` +
          `duration=${fadeDur}:` +
          `offset=${currentOffset}` +
          `${nextNode}`;

        if (!isLast) {
          filterComplex += ";";
        }

        lastNode = nextNode;
      }

      ffmpegArgs.push(
        "-filter_complex",
        filterComplex,
        "-map",
        "[outv]"
      );
    } else {
      filterComplex = filterComplex.slice(0, -1);

      ffmpegArgs.push(
        "-filter_complex",
        filterComplex,
        "-map",
        "[v0]"
      );
    }

    if (audioFile) {
      const audioInputIndex = videoFiles.length;

      ffmpegArgs.push(
        "-map",
        `${audioInputIndex}:a`,
        "-c:a",
        "aac",
        "-b:a",
        "192k"
      );
    }

    ffmpegArgs.push(
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-t",
      `${duracionTotal}`
    );

    if (audioFile) {
      ffmpegArgs.push("-shortest");
    }

    ffmpegArgs.push("output.mp4");

    log(
      `[INFO] 🚀 Renderizando video localmente ` +
      `(Tiempo Total Exacto: ${duracionTotal}s)...`
    );

    if (isRenderCancelled()) {
      throw new Error(
        "El renderizado fue cancelado."
      );
    }

    let codigoRetorno;

    try {
      codigoRetorno = await ffmpeg.exec(ffmpegArgs);
    } catch (error) {
      if (isRenderCancelled()) {
        throw new Error(
          "El renderizado fue cancelado."
        );
      }

      throw error;
    }

    if (isRenderCancelled()) {
      throw new Error(
        "El renderizado fue cancelado."
      );
    }

    if (codigoRetorno !== 0) {
      throw new Error(
        "El motor de video falló. Revisa que las imágenes no estén corruptas."
      );
    }

    if (isRenderCancelled()) {
      throw new Error(
        "El renderizado fue cancelado."
      );
    }

    log("[INFO] 💾 Empaquetando archivo MP4...");

    let data;

    try {
      data = await ffmpeg.readFile("output.mp4");
    } catch (error) {
      if (isRenderCancelled()) {
        throw new Error(
          "El renderizado fue cancelado."
        );
      }

      throw error;
    }

    if (isRenderCancelled()) {
      throw new Error(
        "El renderizado fue cancelado."
      );
    }

    const videoBlob = new Blob([data], {
      type: "video/mp4"
    });

    const videoUrl = URL.createObjectURL(videoBlob);

    log(
      `[INFO] ✅ Vídeo generado correctamente: ${duracionTotal}s`
    );

    return videoUrl;
  } finally {
    if (ffmpeg && !renderState.cancelled) {
      await cleanFFmpegFiles(
        ffmpeg,
        videoFiles.length
      );
    }

    if (
      ffmpegInstance === ffmpeg &&
      renderState.cancelled
    ) {
      ffmpegInstance = null;
    }

    if (activeRender === renderState) {
      activeRender = null;
    }

    isRendering = false;

    if (resolveRenderStop) {
      resolveRenderStop();
    }
  }
}