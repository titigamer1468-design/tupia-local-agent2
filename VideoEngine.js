// =================================================================
// 🎬 VideoEngine.js - MOTOR DE RENDERIZADO 3D (FFMPEG + CANVAS)
// =================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;

/**
 * 🖼️ Generador de Capas Adaptativo
 */
export const createFrame = (file, textOverlay, fontSize, textColor, format) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const isVert = format === 'vertical';
      
      const targetW = isVert ? 1080 : 1920;
      const targetH = isVert ? 1920 : 1080;
      
      canvas.width = targetW; 
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = "#050505"; 
      ctx.fillRect(0, 0, targetW, targetH);
      
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h);
      
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
 * 🎥 Controlador Principal FFmpeg con TRANSICIONES XFADE
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
  onLog("[INFO] ⚡ Inicializando Tupia Video Engine 3D (Con Transiciones)...");

  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
    ffmpegInstance.on('log', ({ message }) => onLog(`[FFMPEG] ${message}`));
    
    onLog("[INFO] 🌐 Conectando núcleos remotos...");
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
  }
  
  const ffmpeg = ffmpegInstance;

  onLog(`[INFO] ✍️ Preparando ${videoFiles.length} fotogramas maestros...`);
  for (let i = 0; i < videoFiles.length; i++) {
    const textoIA = directorPlan && directorPlan[i] ? directorPlan[i].texto_pantalla : null;
    const jpgBlob = await createFrame(videoFiles[i].file, textoIA, fontSize, textColor, videoFormat);
    await ffmpeg.writeFile(`img${i}.jpg`, await fetchFile(jpgBlob));
  }

  let ffmpegArgs = [];
  
  // 🔥 MATEMÁTICA DE TIEMPO EXACTA PARA TRANSICIONES 🔥
  const fadeDur = 0.8; // 0.8 segundos de transición fluida
  const fps = 30;
  let duracionTotal = 0;

  // 1. INPUTS (Añadiendo el tiempo de superposición a cada clip)
  for (let i = 0; i < videoFiles.length; i++) {
    let baseDur = directorPlan && directorPlan[i] ? directorPlan[i].duracion : 5;
    
    // 🔥 EL SECRETO DE LOS 62 SEGUNDOS 🔥
    // Le regalamos 2 segundos extra matemáticamente al último clip
    if (i === videoFiles.length - 1) {
        baseDur += 2;
    }

    duracionTotal += baseDur; // Sumamos la duración pura al total
    
    let inputDur = baseDur;
    // Si no es el último clip, le agregamos el tiempo de superposición
    if (i < videoFiles.length - 1) {
        inputDur += fadeDur; 
    }
    
    ffmpegArgs.push('-loop', '1', '-framerate', `${fps}`, '-t', `${inputDur}`, '-i', `img${i}.jpg`);
  }
  
  if (audioFile) {
    onLog("[INFO] 🎵 Empaquetando música de fondo...");
    await ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile));
    ffmpegArgs.push('-i', 'audio.mp3');
  }

  onLog("[INFO] 🎥 Procesando Cámaras 3D y Transiciones (Crossfade)...");
  
  let filterComplex = "";
  
  const isVert = videoFormat === 'vertical';
  const targetW = isVert ? 1080 : 1920;
  const targetH = isVert ? 1920 : 1080;
  const zoomW = isVert ? 1200 : 2133;
  const zoomH = isVert ? 2133 : 1200;

  // 2. APLICAR ZOOM 3D A CADA CLIP INDIVIDUALMENTE
  for (let i = 0; i < videoFiles.length; i++) {
    const clipEfecto = directorPlan && directorPlan[i] ? directorPlan[i].efecto_camara : null;
    const efectoAplicar = clipEfecto || ['zoom_in_3d', 'pan_right', 'zoom_out_3d', 'pan_left'][i % 4];

    let cameraFX = "";
    if (efectoAplicar === 'zoom_in_3d') { 
      cameraFX = `scale=${zoomW}:${zoomH},rotate='0.02*sin(t)':ow=${zoomW}:oh=${zoomH}:c=black,zoompan=z='min(1+in*0.0015,1.2)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    } else if (efectoAplicar === 'zoom_out_3d') { 
      cameraFX = `scale=${zoomW}:${zoomH},rotate='-0.02*sin(t)':ow=${zoomW}:oh=${zoomH}:c=black,zoompan=z='max(1.2-in*0.0015,1.0)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    } else if (efectoAplicar === 'pan_right') {
      cameraFX = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=1:x='iw/2-(iw/zoom/2)+in*0.5':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    } else { 
      cameraFX = `scale=${zoomW}:${zoomH},zoompan=z=1.15:d=1:x='iw/2-(iw/zoom/2)-in*0.5':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}:fps=${fps}`;
    }

    // Obligamos a FFmpeg a tener el mismo formato exacto para que el Crossfade no explote
    filterComplex += `[${i}:v]${cameraFX},setsar=1/1,format=yuv420p[v${i}];`;
  }

  // 3. ENCADENAR LAS TRANSICIONES SUAVES (XFADE)
  if (videoFiles.length > 1) {
      let lastNode = "[v0]";
      let currentOffset = 0;
      
      for (let i = 1; i < videoFiles.length; i++) {
          let prevBaseDur = directorPlan && directorPlan[i-1] ? directorPlan[i-1].duracion : 5;
          currentOffset += prevBaseDur; // Empalme milimétrico basado en la duración pura
          
          const isLast = (i === videoFiles.length - 1);
          const nextNode = isLast ? "[outv]" : `[xf${i}]`;
          
          // xfade toma los dos clips y los funde
          filterComplex += `${lastNode}[v${i}]xfade=transition=fade:duration=${fadeDur}:offset=${currentOffset}${nextNode}`;
          if (!isLast) filterComplex += ';';
          
          lastNode = nextNode;
      }
      ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[outv]');
  } else {
      filterComplex = filterComplex.slice(0, -1);
      ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[v0]');
  }

  // 4. MAPEO DE AUDIO Y CIERRE
  if (audioFile) {
    const audioInputIndex = videoFiles.length; 
    ffmpegArgs.push('-map', `${audioInputIndex}:a`, '-c:a', 'aac', '-b:a', '192k');
  }

  ffmpegArgs.push(
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-t', `${duracionTotal}`, // Tiempo final exacto (62s garantizado)
    'output.mp4'
  );

  onLog(`[INFO] 🚀 Renderizando hardware (Tiempo Total Exacto: ${duracionTotal}s)...`);
  
  const codigoRetorno = await ffmpeg.exec(ffmpegArgs);
  if (codigoRetorno !== 0) throw new Error("Compilación abortada. Código de error: " + codigoRetorno);

  const data = await ffmpeg.readFile('output.mp4');
  const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
  const videoUrl = URL.createObjectURL(videoBlob);

  onLog(`[INFO] ✅ ¡Operación exitosa! Tu obra maestra de ${duracionTotal}s te espera.`);
  return videoUrl;
}
