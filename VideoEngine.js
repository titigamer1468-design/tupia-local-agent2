// =================================================================
// 🎬 VideoEngine.js - MOTOR DE RENDERIZADO 3D (FFMPEG + CANVAS)
// =================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Instancia global en memoria. 
// Esto hace que el segundo video que renderices sea muchísimo más rápido.
let ffmpegInstance = null;

/**
 * 🖼️ Generador de Capas Adaptativo (Textos + Escala)
 * Normaliza las imágenes a la resolución perfecta y quema los textos antes de dárselas a FFmpeg.
 */
export const createFrame = (file, textOverlay, fontSize, textColor, format) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const isVert = format === 'vertical';
      
      // Dimensiones exactas requeridas por YouTube Shorts / Reels o formato TV
      const targetW = isVert ? 1080 : 1920;
      const targetH = isVert ? 1920 : 1080;
      
      canvas.width = targetW; 
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      
      // Fondo oscuro absoluto para márgenes seguros
      ctx.fillStyle = "#050505"; 
      ctx.fillRect(0, 0, targetW, targetH);
      
      // Escalar tipo Cover (Llena toda la pantalla recortando el sobrante)
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h);
      
      // Estampar Textos si el Director de IA lo ordenó
      if (textOverlay) {
        ctx.font = `bold ${fontSize}px 'Impact', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(4, fontSize * 0.1);
        ctx.strokeStyle = "black"; // Contorno
        ctx.fillStyle = textColor; // Relleno
        
        // Sombra paralela para máxima legibilidad sobre cualquier foto
        ctx.shadowColor = "rgba(0,0,0,0.9)"; 
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        const lines = textOverlay.split('\\n');
        const centerY = targetH / 2;
        
        lines.forEach((line, i) => {
           const yPos = centerY + (i * (parseInt(fontSize) + 20)) - ((lines.length - 1) * (parseInt(fontSize) / 2));
           ctx.strokeText(line, targetW / 2, yPos);
           ctx.fillText(line, targetW / 2, yPos);
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

/**
 * 🎥 Controlador Principal FFmpeg (Orquestador de línea de tiempo)
 */
export async function renderVideo({ 
  videoFiles, 
  audioFile, 
  directorPlan, 
  fontSize, 
  textColor, 
  videoFormat, 
  onLog 
}) {
  onLog("[INFO] ⚡ Inicializando Tupia Video Engine 3D...");

  // Inicializar WebAssembly solo si no existe
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
    ffmpegInstance.on('log', ({ message }) => onLog(`[FFMPEG] ${message}`));
    
    onLog("[INFO] 🌐 Descargando y conectando núcleos remotos (ESM)...");
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
  }
  
  const ffmpeg = ffmpegInstance;

  // 1. DIBUJAR LIENZOS
  onLog(`[INFO] ✍️ Dibujando ${videoFiles.length} fotogramas maestros en formato ${videoFormat.toUpperCase()}...`);
  for (let i = 0; i < videoFiles.length; i++) {
    const textoIA = directorPlan && directorPlan[i] ? directorPlan[i].texto_pantalla : null;
    const jpgBlob = await createFrame(videoFiles[i].file, textoIA, fontSize, textColor, videoFormat);
    await ffmpeg.writeFile(`img${i}.jpg`, await fetchFile(jpgBlob));
  }

  let ffmpegArgs = [];
  
  // 2. INPUT DE IMÁGENES
  for (let i = 0; i < videoFiles.length; i++) {
    const clipDur = directorPlan && directorPlan[i] ? directorPlan[i].duracion : 5;
    ffmpegArgs.push('-loop', '1', '-t', `${clipDur}`, '-i', `img${i}.jpg`);
  }
  
  // 3. INPUT DE AUDIO
  if (audioFile) {
    onLog("[INFO] 🎵 Empaquetando música de fondo...");
    await ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile));
    ffmpegArgs.push('-i', 'audio.mp3');
  }

  onLog("[INFO] 🎥 Calculando algoritmos y vectores de cámara 3D...");
  
  let filterComplex = "";
  let concatInputs = "";
  let duracionTotal = 0;
  const fps = 30;

  // Variables matemáticas para formato perfecto
  const isVert = videoFormat === 'vertical';
  const targetW = isVert ? 1080 : 1920;
  const targetH = isVert ? 1920 : 1080;
  
  // Margen de seguridad para rotación sin que salgan bordes negros
  const zoomW = isVert ? 1200 : 2133;
  const zoomH = isVert ? 2133 : 1200;

  // 4. GENERADOR DE FILTROS COMPLEJOS
  for (let i = 0; i < videoFiles.length; i++) {
    const clipDur = directorPlan && directorPlan[i] ? directorPlan[i].duracion : 5;
    const clipEfecto = directorPlan && directorPlan[i] ? directorPlan[i].efecto_camara : "zoom_in_3d";
    const frames = Math.round(clipDur * fps);
    duracionTotal += clipDur;

    let cameraFX = "";
    if (clipEfecto === 'zoom_in_3d' || clipEfecto === 'zoom_out_3d') { 
      cameraFX = `scale=${zoomW}:${zoomH},rotate='0.02*sin(t)':ow=${zoomW}:oh=${zoomH}:c=black,zoompan=z='min(zoom+0.0015,1.2)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    } else if (clipEfecto === 'pan_right') {
      cameraFX = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)+in*2':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    } else { 
      cameraFX = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)-in*2':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    }

    // Modo manual (intercalado si la IA no dictó guion)
    if (!directorPlan) {
      const mod = i % 3;
      if (mod === 0) cameraFX = `scale=${zoomW}:${zoomH},rotate='0.02*sin(t)':ow=${zoomW}:oh=${zoomH}:c=black,zoompan=z='min(zoom+0.002,1.2)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
      if (mod === 1) cameraFX = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)+in*2':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
      if (mod === 2) cameraFX = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=${frames}:x='iw/2-(iw/zoom/2)-in*2':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    }

    filterComplex += `[${i}:v]${cameraFX}[v${i}];`;
    concatInputs += `[v${i}]`;
  }

  // 5. UNIFICACIÓN DE PISTAS (CONCATENACIÓN)
  if (videoFiles.length > 1) {
      filterComplex += `${concatInputs}concat=n=${videoFiles.length}:v=1:a=0[outv]`;
      ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[outv]');
  } else {
      filterComplex = filterComplex.slice(0, -1);
      ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[v0]');
  }

  // 6. ASIGNACIÓN DE AUDIO Y SALIDA
  if (audioFile) {
    const audioInputIndex = videoFiles.length; 
    ffmpegArgs.push('-map', `${audioInputIndex}:a`, '-c:a', 'aac', '-b:a', '192k');
  }

  ffmpegArgs.push(
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-t', `${duracionTotal}`, // Tiempo exacto e inflexible
    'output.mp4'
  );

  onLog(`[INFO] 🚀 Iniciando Compresión de Hardware (Video final de ${duracionTotal}s)...`);
  
  const codigoRetorno = await ffmpeg.exec(ffmpegArgs);
  if (codigoRetorno !== 0) throw new Error("Compilación abortada. Código de error FFmpeg: " + codigoRetorno);

  const data = await ffmpeg.readFile('output.mp4');
  const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
  const videoUrl = URL.createObjectURL(videoBlob);

  onLog(`[INFO] ✅ ¡Operación exitosa! Video listo para descargar.`);
  return videoUrl;
}
