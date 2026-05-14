import { loadImg, getAverageBrightness, getAspectRatioValue } from './imageHelpers';
import type { ImageItem, GifshotResult } from '../types';

interface GenerateCollageParams {
  images: ImageItem[];
  refId: string | null;
  aspectRatio: string;
  gifResolution: number;
  gifQuality: number;
  enableDeflickering: boolean;
}

export async function generateCollage(params: GenerateCollageParams): Promise<void> {
  const { images, refId, aspectRatio, gifResolution, gifQuality, enableDeflickering } = params;

  if (images.length === 0 || !refId) return;
  const refImgData = images.find((i) => i.id === refId);
  if (!refImgData) return;

  const targetRatio = getAspectRatioValue(aspectRatio);
  let baseWidth = refImgData.width * gifResolution;

  // Safety cap: Avoid extremely large exports that crash the browser
  const MAX_EXPORT_WIDTH = 1280;
  if (baseWidth > MAX_EXPORT_WIDTH) baseWidth = MAX_EXPORT_WIDTH;

  const outWidth = Math.floor(baseWidth);
  const outHeight = Math.floor(targetRatio ? baseWidth / targetRatio : refImgData.height * (outWidth / refImgData.width));

  // Cap total canvas width to avoid browser limits (~8192px is safe)
  const MAX_TOTAL_WIDTH = 4096;
  const imagesPerRow = Math.max(1, Math.floor(MAX_TOTAL_WIDTH / outWidth));
  const rows = Math.ceil(images.length / imagesPerRow);

  const canvas = document.createElement('canvas');
  canvas.width = Math.min(outWidth * images.length, outWidth * imagesPerRow);
  canvas.height = outHeight * rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let refBrightness = 128;
  if (enableDeflickering) {
    const refImg = await loadImg(refImgData.url);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 100;
    tempCanvas.height = 100;
    const tctx = tempCanvas.getContext('2d');
    if (tctx) {
      tctx.drawImage(refImg, 0, 0, 100, 100);
      refBrightness = getAverageBrightness(tctx, 100, 100);
    }
  }

  for (let i = 0; i < images.length; i++) {
    const imgData = images[i];
    const img = await loadImg(imgData.url);

    ctx.save();
    ctx.beginPath();
    ctx.rect(i * outWidth, 0, outWidth, outHeight);
    ctx.clip();

    ctx.fillStyle = '#000';
    ctx.fillRect(i * outWidth, 0, outWidth, outHeight);

    if (enableDeflickering) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 100;
      tempCanvas.height = 100;
      const tctx = tempCanvas.getContext('2d');
      if (tctx) {
        tctx.drawImage(img, 0, 0, 100, 100);
        const currentBrightness = getAverageBrightness(tctx, 100, 100);
        const ratio = refBrightness / (currentBrightness || 1);
        const clampedRatio = Math.max(0.5, Math.min(2.0, ratio));
        ctx.filter = `brightness(${clampedRatio})`;
      }
    }

    const row = Math.floor(i / imagesPerRow);
    const col = i % imagesPerRow;
    const slotCenterX = col * outWidth + outWidth / 2;
    const slotCenterY = row * outHeight + outHeight / 2;

    const realX = imgData.xFrac * outWidth;
    const realY = imgData.yFrac * outWidth;

    ctx.translate(slotCenterX + realX, slotCenterY + realY);
    ctx.rotate((imgData.rotation * Math.PI) / 180);
    ctx.scale(imgData.scale * gifResolution, imgData.scale * gifResolution);

    const drawW = imgData.width;
    const drawH = imgData.height;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  const jpegQuality = 0.5 + (gifQuality / 10) * 0.5;
  const link = document.createElement('a');
  link.download = 'timelapse-collage.jpg';
  link.href = canvas.toDataURL('image/jpeg', jpegQuality);
  link.click();
}

interface GenerateGIFParams {
  images: ImageItem[];
  refId: string | null;
  aspectRatio: string;
  gifResolution: number;
  gifQuality: number;
  holdTime: number;
  enableFading: boolean;
  enableDeflickering: boolean;
  fadeTime: number;
  onProgress?: (progress: number) => void;
}

export async function generateGIF(params: GenerateGIFParams): Promise<void> {
  const { images, refId, aspectRatio, gifResolution, gifQuality, holdTime, enableFading, enableDeflickering, fadeTime, onProgress } = params;

  if (images.length === 0 || !refId) return;
  if (!window.gifshot) {
    alert("GIF Encoder wird noch geladen. Bitte versuche es in wenigen Sekunden erneut.");
    return;
  }

  const refImgData = images.find((i) => i.id === refId);
  if (!refImgData) return;

  const targetRatio = getAspectRatioValue(aspectRatio);
  let baseWidth = refImgData.width * gifResolution;

  const MAX_EXPORT_WIDTH = 1280;
  if (baseWidth > MAX_EXPORT_WIDTH) baseWidth = MAX_EXPORT_WIDTH;

  const outWidth = Math.floor(baseWidth);
  const outHeight = Math.floor(targetRatio ? baseWidth / targetRatio : refImgData.height * (outWidth / refImgData.width));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const loadedImages = await Promise.all(images.map(img => loadImg(img.url)));

  const brightnessRatios: Record<number, number> = {};
  if (enableDeflickering) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 100;
    tempCanvas.height = 100;
    const tctx = tempCanvas.getContext('2d');
    if (tctx) {
      const refImgIdx = images.findIndex(img => img.id === refId);
      tctx.drawImage(loadedImages[refImgIdx === -1 ? 0 : refImgIdx], 0, 0, 100, 100);
      const refBrightness = getAverageBrightness(tctx, 100, 100);

      loadedImages.forEach((img, idx) => {
        tctx.clearRect(0, 0, 100, 100);
        tctx.drawImage(img, 0, 0, 100, 100);
        const currentBrightness = getAverageBrightness(tctx, 100, 100);
        const ratio = refBrightness / (currentBrightness || 1);
        brightnessRatios[idx] = Math.max(0.5, Math.min(2.0, ratio));
      });
    }
  }

  const drawImageScaled = (imgIdx: number, alpha = 1) => {
    const imgData = images[imgIdx];
    const img = loadedImages[imgIdx];

    ctx.save();
    ctx.globalAlpha = alpha;

    if (enableDeflickering && brightnessRatios[imgIdx]) {
      ctx.filter = `brightness(${brightnessRatios[imgIdx]})`;
    }

    const slotCenterX = outWidth / 2;
    const slotCenterY = outHeight / 2;

    const realX = imgData.xFrac * outWidth;
    const realY = imgData.yFrac * outWidth;

    ctx.translate(slotCenterX + realX, slotCenterY + realY);
    ctx.rotate((imgData.rotation * Math.PI) / 180);
    ctx.scale(imgData.scale * gifResolution, imgData.scale * gifResolution);

    const drawW = imgData.width;
    const drawH = imgData.height;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };

  const fps = 10;
  const framesCountHold = Math.max(1, Math.round(holdTime * fps));
  const framesCountFade = enableFading ? Math.max(1, Math.round(fadeTime * fps)) : 0;

  const frames: string[] = [];
  const jpegQuality = 0.5 + (gifQuality / 10) * 0.5;

  for (let i = 0; i < images.length; i++) {
    for (let h = 0; h < framesCountHold; h++) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, outWidth, outHeight);
      drawImageScaled(i, 1);
      frames.push(canvas.toDataURL(gifQuality > 8 ? 'image/png' : 'image/jpeg', jpegQuality));
    }

    if (enableFading && i < images.length - 1) {
      for (let f = 1; f <= framesCountFade; f++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, outWidth, outHeight);
        drawImageScaled(i, 1);
        drawImageScaled(i + 1, f / framesCountFade);
        frames.push(canvas.toDataURL(gifQuality > 8 ? 'image/png' : 'image/jpeg', jpegQuality));
      }
    }
  }

  const sampleInterval = 22 - (gifQuality * 2);

  try {
    window.gifshot.createGIF({
      gifWidth: outWidth,
      gifHeight: outHeight,
      images: frames,
      interval: 1 / fps,
      sampleInterval: sampleInterval,
      progressCallback: (captureProgress: number) => {
        onProgress?.(Math.min(0.99, captureProgress));
      }
    }, function(obj: GifshotResult) {
      if (!obj.error && obj.image) {
        try {
          const link = document.createElement('a');
          link.download = 'timelapse.gif';
          link.href = obj.image;
          link.click();
          onProgress?.(1);
        } catch (e) {
          console.error("Link creation error", e);
          alert("Fehler beim Speichern des GIFs.");
        }
      } else {
        console.error("gifshot error:", obj.error, obj.errorCode, obj.errorMsg);
        alert(`Ein Fehler ist bei der GIF Generierung aufgetreten: ${obj.errorMsg || 'Unbekannter Fehler'}`);
      }
    });
  } catch (err) {
    console.error("GIF generation crash:", err);
    alert("Kritischer Fehler bei der GIF-Erstellung. Reduziere ggf. die Auflösung.");
  }
}
