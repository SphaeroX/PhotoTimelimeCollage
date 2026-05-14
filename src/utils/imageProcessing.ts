import { loadImg } from './imageHelpers';
import type { ImageItem } from '../types';

interface AutoAlignParams {
  refImage: ImageItem;
  activeImage: ImageItem;
  worldWidth: number;
  edgeMode: boolean;
  edgeThreshold: number;
}

interface AutoAlignResult {
  xFrac: number;
  yFrac: number;
  rotation: number;
  scale: number;
}

// --- Helper: extract grayscale luminance from ImageData (samples every 4th pixel for speed) ---
function extractGrayscale(data: Uint8ClampedArray, width: number, height: number, step: number): Float32Array {
  const n = Math.floor(width * height / step);
  const gray = new Float32Array(n);
  let gi = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    gray[gi++] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

// --- Helper: apply Laplacian edge-detection kernel on grayscale ---
function applyLaplacianEdges(gray: Float32Array, w: number, h: number): Float32Array {
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      edges[idx] =
        -gray[(y - 1) * w + (x - 1)] - gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
        -gray[y * w + (x - 1)]       + 8 * gray[idx]        - gray[y * w + (x + 1)]
        -gray[(y + 1) * w + (x - 1)] - gray[(y + 1) * w + x] - gray[(y + 1) * w + (x + 1)];
    }
  }
  return edges;
}

// --- Helper: threshold edge values (matching SVG feComponentTransfer filter) ---
function thresholdEdges(edges: Float32Array, threshold: number): Float32Array {
  let maxVal = 0;
  for (let i = 0; i < edges.length; i++) {
    const abs = Math.abs(edges[i]);
    if (abs > maxVal) maxVal = abs;
  }
  if (maxVal === 0) maxVal = 1;

  const intercept = -threshold;
  const result = new Float32Array(edges.length);
  for (let i = 0; i < edges.length; i++) {
    const normalized = Math.abs(edges[i]) / maxVal;
    const shifted = normalized + intercept;
    result[i] = shifted > 0 ? shifted : 0;
  }
  return result;
}

// --- Helper: compute gradient magnitude using Sobel operator ---
function computeGradientMagnitude(gray: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
        - 2 * gray[y * w + (x - 1)]   + 2 * gray[y * w + (x + 1)]
        - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
        + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
      mag[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

// --- Helper: build feature array from drawn canvas ---
function buildFeatures(ctx: CanvasRenderingContext2D, size: number, edgeMode: boolean, edgeThreshold: number): Float32Array {
  const imageData = ctx.getImageData(0, 0, size, size);
  const gray = extractGrayscale(imageData.data, size, size, 1);

  if (edgeMode) {
    const edges = applyLaplacianEdges(gray, size, size);
    const thresh = edgeThreshold / 100;
    return thresholdEdges(edges, thresh);
  } else {
    return computeGradientMagnitude(gray, size, size);
  }
}

// --- Helper: compute SSD error between two feature arrays ---
function computeError(f1: Float32Array, f2: Float32Array): number {
  let e = 0;
  for (let i = 0; i < f1.length; i++) {
    const d = f1[i] - f2[i];
    e += d * d;
  }
  return e;
}

// --- Helper: compute mean of a feature array ---
function computeMean(arr: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

export async function autoAlignActiveImage(params: AutoAlignParams): Promise<AutoAlignResult | null> {
  const { refImage, activeImage, worldWidth, edgeMode, edgeThreshold } = params;

  const [imgRef, imgAct] = await Promise.all([loadImg(refImage.url), loadImg(activeImage.url)]);

  const alignOnScale = (
    size: number,
    range: number,
    sx = 0,
    sy = 0,
    searchRotation = false,
    baseRot = 0,
  ) => {
    const c1 = document.createElement('canvas');
    const c2 = document.createElement('canvas');
    c1.width = c2.width = size;
    c1.height = c2.height = size;
    const ctx1 = c1.getContext('2d', { willReadFrequently: true });
    const ctx2 = c2.getContext('2d', { willReadFrequently: true });
    if (!ctx1 || !ctx2) return { x: 0, y: 0, rot: baseRot };

    const draw = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, ox: number, oy: number, rot = 0) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      const totalRot = baseRot + rot;
      if (totalRot !== 0) {
        ctx.translate(size / 2 + ox, size / 2 + oy);
        ctx.rotate(totalRot * Math.PI / 180);
        ctx.translate(-(size / 2 + ox), -(size / 2 + oy));
      }
      const s = Math.min(size / img.width, size / img.height);
      ctx.drawImage(img, (size - img.width * s) / 2 + ox, (size - img.height * s) / 2 + oy, img.width * s, img.height * s);
      ctx.restore();
    };

    draw(ctx1, imgRef, 0, 0);
    const feat1 = buildFeatures(ctx1, size, edgeMode, edgeThreshold);

    let refMean = 0;
    if (!edgeMode) {
      refMean = computeMean(feat1);
    }

    let bx = sx, by = sy, brot = 0, me = Infinity;
    const rotations = searchRotation ? [-3, -1.5, 0, 1.5, 3] : [0];

    for (const rot of rotations) {
      for (let y = sy - range; y <= sy + range; y++) {
        for (let x = sx - range; x <= sx + range; x++) {
          draw(ctx2, imgAct, x, y, rot);
          const feat2 = buildFeatures(ctx2, size, edgeMode, edgeThreshold);

          let e: number;
          if (edgeMode) {
            e = computeError(feat1, feat2);
          } else {
            const actMean = computeMean(feat2);
            const diffM = refMean - actMean;
            let err = 0;
            for (let i = 0; i < feat2.length; i++) {
              const d = feat1[i] - (feat2[i] + diffM);
              err += d * d;
            }
            e = err;
          }

          if (e < me) { me = e; bx = x; by = y; brot = rot; }
        }
      }
    }
    return { x: bx, y: by, rot: baseRot + brot };
  };

  // Level 1: Coarse search (32px, +/- 12px range, with 3° rotation search)
  const c = alignOnScale(32, 12, 0, 0, true);
  // Level 2: Mid search (64px, +/- 6px range, applying coarse rotation)
  const m = alignOnScale(64, 6, c.x * 2, c.y * 2, false, c.rot);
  // Level 3: Fine search (128px, +/- 4px range, applying mid rotation)
  const f = alignOnScale(128, 4, m.x * 2, m.y * 2, false, m.rot);

  // Detected offset as fraction of world width
  const dxRaw = (-f.x / 128) * (refImage.width / worldWidth);
  const dyRaw = (-f.y / 128) * (refImage.width / worldWidth);

  const totalRotation = refImage.rotation + c.rot;
  const rad = (totalRotation * Math.PI) / 180;
  const rotX = (dxRaw * Math.cos(rad) - dyRaw * Math.sin(rad)) * refImage.scale;
  const rotY = (dxRaw * Math.sin(rad) + dyRaw * Math.cos(rad)) * refImage.scale;

  return {
    xFrac: refImage.xFrac + rotX,
    yFrac: refImage.yFrac + rotY,
    rotation: totalRotation,
    scale: refImage.scale,
  };
}

interface PointAlignmentParams {
  refImage: ImageItem;
  activeImage: ImageItem;
  worldWidth: number;
  refPoints: { x: number; y: number }[];
  activePoints: { x: number; y: number }[];
  enablePointScale: boolean;
}

export function applyPointAlignment(params: PointAlignmentParams): AutoAlignResult | null {
  const { refImage, activeImage, worldWidth, refPoints, activePoints, enablePointScale } = params;

  if (refPoints.length < 2 || activePoints.length < 2) return null;

  // Points are in 0-1 range of their respective images
  const p1 = { x: refPoints[0].x * refImage.width, y: refPoints[0].y * refImage.height };
  const p2 = { x: refPoints[1].x * refImage.width, y: refPoints[1].y * refImage.height };
  const q1 = { x: activePoints[0].x * activeImage.width, y: activePoints[0].y * activeImage.height };
  const q2 = { x: activePoints[1].x * activeImage.width, y: activePoints[1].y * activeImage.height };

  // Vectors in "image pixels"
  const dxP = p2.x - p1.x;
  const dyP = p2.y - p1.y;
  const distP = Math.sqrt(dxP * dxP + dyP * dyP);
  const angleP = Math.atan2(dyP, dxP);

  const dxQ = q2.x - q1.x;
  const dyQ = q2.y - q1.y;
  const distQ = Math.sqrt(dxQ * dxQ + dyQ * dyQ);
  const angleQ = Math.atan2(dyQ, dxQ);

  if (distQ === 0 || distP === 0) return null;

  // 1. Calculate new scale and rotation relative to ref image's CURRENT state
  const scaleRatio = distP / distQ;
  const newScale = enablePointScale ? refImage.scale * scaleRatio : activeImage.scale;

  const angleDiff = (angleP - angleQ) * (180 / Math.PI);
  const newRotation = refImage.rotation + angleDiff;

  // 2. Calculate translation to align Q1 with P1 in container space
  const offPX = (p1.x - refImage.width / 2) / worldWidth;
  const offPY = (p1.y - refImage.height / 2) / worldWidth;

  const radRef = (refImage.rotation * Math.PI) / 180;
  const targetPX = refImage.xFrac + (offPX * Math.cos(radRef) - offPY * Math.sin(radRef)) * refImage.scale;
  const targetPY = refImage.yFrac + (offPX * Math.sin(radRef) + offPY * Math.cos(radRef)) * refImage.scale;

  // Now find the relative offset of Q1 in the active image
  const offQX = (q1.x - activeImage.width / 2) / worldWidth;
  const offQY = (q1.y - activeImage.height / 2) / worldWidth;

  const radAct = (newRotation * Math.PI) / 180;
  const rotQX = (offQX * Math.cos(radAct) - offQY * Math.sin(radAct)) * newScale;
  const rotQY = (offQX * Math.sin(radAct) + offQY * Math.cos(radAct)) * newScale;

  // Resulting xFrac/yFrac
  const newXFrac = targetPX - rotQX;
  const newYFrac = targetPY - rotQY;

  return {
    scale: newScale,
    rotation: newRotation,
    xFrac: newXFrac,
    yFrac: newYFrac,
  };
}
