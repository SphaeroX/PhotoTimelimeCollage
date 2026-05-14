import { ASPECT_RATIOS } from '../types';
import type { ImageItem } from '../types';

export const loadImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.src = src;
    img.onload = () => res(img);
    img.onerror = rej;
  });

export const getAverageBrightness = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  x = 0,
  y = 0
) => {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  let totalLuma = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return totalLuma / (data.length / 4);
};

export const getAspectRatioValue = (aspectRatio: string) => {
  const found = ASPECT_RATIOS.find((r) => r.value === aspectRatio);
  if (!found || found.value === 'original') return null;
  const [w, h] = found.value.split(':').map(Number);
  return w / h;
};

export const getEstimatedSize = (
  images: ImageItem[],
  refId: string | null,
  holdTime: number,
  fadeTime: number,
  enableFading: boolean,
  gifQuality: number,
  gifResolution: number
) => {
  if (images.length === 0 || !refId) return 0;
  const refImgData = images.find((i) => i.id === refId);
  if (!refImgData) return 0;

  const fps = 10;
  const framesCountHold = Math.max(1, Math.round(holdTime * fps));
  const framesCountFade = enableFading ? Math.max(1, Math.round(fadeTime * fps)) : 0;
  const totalFrames = images.length * framesCountHold + (images.length - 1) * framesCountFade;

  const outWidth = Math.floor(refImgData.width * gifResolution);
  const outHeight = Math.floor(
    refImgData.width / refImgData.height
      ? outWidth / (refImgData.width / refImgData.height)
      : refImgData.height * gifResolution
  );

  const qualityMultiplier = 0.1 + (gifQuality / 10) * 0.2;
  const sizeBytes = outWidth * outHeight * totalFrames * qualityMultiplier;
  return sizeBytes / (1024 * 1024);
};

export const getEstimatedCollageSize = (
  images: ImageItem[],
  refId: string | null,
  aspectRatio: string,
  gifResolution: number
) => {
  if (images.length === 0 || !refId) return 0;
  const refImgData = images.find((i) => i.id === refId);
  if (!refImgData) return 0;

  const outWidth = Math.floor(refImgData.width * gifResolution);
  const targetRatio = getAspectRatioValue(aspectRatio);
  const outHeight = Math.floor(
    targetRatio ? outWidth / targetRatio : refImgData.height * gifResolution
  );

  const sizeBytes = outWidth * outHeight * images.length * 0.3;
  return sizeBytes / (1024 * 1024);
};
