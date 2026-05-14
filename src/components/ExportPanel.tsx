import { Crop, Settings2, Layout, Film, Download, Loader2 } from 'lucide-react';
import { ASPECT_RATIOS } from '../types';
import type { ImageItem } from '../types';

interface ExportPanelProps {
  // Aspect ratio
  aspectRatio: string;
  setAspectRatio: (value: string) => void;

  // Resolution & Quality
  gifResolution: number;
  setGifResolution: (value: number) => void;
  gifQuality: number;
  setGifQuality: (value: number) => void;

  // Image data for size estimates and button state
  images: ImageItem[];
  refId: string | null;

  // Collage export
  generateCollage: () => void;

  // GIF settings
  holdTime: number;
  setHoldTime: (value: number) => void;
  enableFading: boolean;
  setEnableFading: (value: boolean) => void;
  enableDeflickering: boolean;
  setEnableDeflickering: (value: boolean) => void;
  fadeTime: number;
  setFadeTime: (value: number) => void;

  // GIF generation state
  isGenerating: boolean;
  progress: number;
  generateGIF: () => void;
}

function getAspectRatioMultiplier(aspectRatio: string): number | null {
  const found = ASPECT_RATIOS.find((r) => r.value === aspectRatio);
  if (!found || found.value === 'original') return null;
  const [w, h] = found.value.split(':').map(Number);
  return w / h;
}

function getEstimatedCollageSize(
  images: ImageItem[],
  refId: string | null,
  gifResolution: number,
  aspectRatio: string,
): number {
  if (images.length === 0 || !refId) return 0;
  const refImgData = images.find((i) => i.id === refId);
  if (!refImgData) return 0;

  const outWidth = Math.floor(refImgData.width * gifResolution);
  const targetRatio = getAspectRatioMultiplier(aspectRatio);
  const outHeight = Math.floor(
    targetRatio ? outWidth / targetRatio : refImgData.height * gifResolution,
  );

  // PNG estimation: roughly 0.3 bytes per pixel (very rough heuristic)
  const sizeBytes = outWidth * outHeight * images.length * 0.3;
  return sizeBytes / (1024 * 1024);
}

function getEstimatedGifSize(
  images: ImageItem[],
  refId: string | null,
  holdTime: number,
  enableFading: boolean,
  fadeTime: number,
  gifResolution: number,
  gifQuality: number,
): number {
  if (images.length === 0 || !refId) return 0;
  const refImgData = images.find((i) => i.id === refId);
  if (!refImgData) return 0;

  const fps = 10;
  const framesCountHold = Math.max(1, Math.round(holdTime * fps));
  const framesCountFade = enableFading ? Math.max(1, Math.round(fadeTime * fps)) : 0;
  const totalFrames =
    images.length * framesCountHold + (images.length - 1) * framesCountFade;

  const outWidth = Math.floor(refImgData.width * gifResolution);
  const outHeight = Math.floor(refImgData.height * gifResolution);

  // GIF estimation: roughly 0.15 bytes per pixel per frame (very rough heuristic)
  const qualityMultiplier = 0.1 + (gifQuality / 10) * 0.2;
  const sizeBytes = outWidth * outHeight * totalFrames * qualityMultiplier;
  return sizeBytes / (1024 * 1024);
}

export default function ExportPanel({
  aspectRatio,
  setAspectRatio,
  gifResolution,
  setGifResolution,
  gifQuality,
  setGifQuality,
  images,
  refId,
  generateCollage,
  holdTime,
  setHoldTime,
  enableFading,
  setEnableFading,
  enableDeflickering,
  setEnableDeflickering,
  fadeTime,
  setFadeTime,
  isGenerating,
  progress,
  generateGIF,
}: ExportPanelProps) {
  const collageSizeMB = getEstimatedCollageSize(images, refId, gifResolution, aspectRatio);
  const gifSizeMB = getEstimatedGifSize(
    images,
    refId,
    holdTime,
    enableFading,
    fadeTime,
    gifResolution,
    gifQuality,
  );

  const canExport = images.length >= 2 && !!refId;

  return (
    <div className="p-4 border-t border-stone-700 flex flex-col gap-4 bg-stone-850 overflow-y-auto max-h-[50vh]">
      {/* Aspect Ratio */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-stone-300">
          <Crop size={18} className="text-emerald-400" />
          <h3 className="font-semibold text-sm">Leinwand &amp; Format</h3>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Aspect ratio">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() => setAspectRatio(ratio.value)}
              role="radio"
              aria-checked={aspectRatio === ratio.value}
              aria-label={ratio.label}
              className={`text-[10px] px-2 py-1.5 rounded border transition-colors ${
                aspectRatio === ratio.value
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
              }`}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px w-full bg-stone-700 my-1" />

      {/* Resolution & Quality */}
      <div className="flex items-center gap-2 text-stone-300">
        <Settings2 size={18} className="text-emerald-400" />
        <h3 className="font-semibold text-sm">Export-Einstellungen</h3>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="export-resolution" className="text-xs text-stone-400 flex justify-between">
            <span>Auflösung (Skalierung)</span>
            <span>{Math.round(gifResolution * 100)}%</span>
          </label>
          <input
            id="export-resolution"
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={gifResolution}
            onChange={(e) => setGifResolution(parseFloat(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="export-quality" className="text-xs text-stone-400 flex justify-between">
            <span>Qualität (Kompression)</span>
            <span>{gifQuality} / 10</span>
          </label>
          <input
            id="export-quality"
            type="range"
            min="1"
            max="10"
            step="1"
            value={gifQuality}
            onChange={(e) => setGifQuality(parseInt(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>
      </div>

      <div className="h-px w-full bg-stone-700 my-1" />

      {/* Collage Export */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-stone-300">
          <Layout size={18} className="text-emerald-400" />
          <h3 className="font-semibold text-sm">Collage Export</h3>
        </div>

        <div className="bg-stone-900/50 p-2 rounded border border-stone-700/50">
          <div className="flex justify-between items-center text-xs">
            <span className="text-stone-400">Geschätzte Größe:</span>
            <span className="font-mono text-emerald-400">
              ~{collageSizeMB.toFixed(1)} MB
            </span>
          </div>
        </div>

        <button
          onClick={generateCollage}
          disabled={!canExport}
          aria-label="Collage speichern"
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-500 text-white p-3 rounded-lg flex justify-center items-center gap-2 transition-colors font-medium text-sm"
        >
          <Download size={18} />
          Collage speichern
        </button>
      </div>

      <div className="h-px w-full bg-stone-700 my-1" />

      {/* GIF Export */}
      <div className="flex items-center gap-2 text-stone-300">
        <Film size={18} className="text-blue-400" />
        <h3 className="font-semibold text-sm">GIF Export</h3>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="gif-hold-time" className="text-xs text-stone-400 flex justify-between">
            <span>Anzeigedauer pro Bild</span>
            <span>{holdTime.toFixed(1)}s</span>
          </label>
          <input
            id="gif-hold-time"
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={holdTime}
            onChange={(e) => setHoldTime(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-400 transition-colors">
            <input
              type="checkbox"
              checked={enableFading}
              onChange={(e) => setEnableFading(e.target.checked)}
              className="rounded bg-stone-700 border-stone-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-stone-800"
            />
            Fading aktivieren
          </label>

          <label
            className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-400 transition-colors"
            title="Passt die Helligkeit der Bilder an das Referenzbild an"
          >
            <input
              type="checkbox"
              checked={enableDeflickering}
              onChange={(e) => setEnableDeflickering(e.target.checked)}
              className="rounded bg-stone-700 border-stone-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-stone-800"
            />
            Helligkeitsausgleich (Deflicker)
          </label>
        </div>

        {enableFading && (
          <div className="flex flex-col gap-1">
            <label htmlFor="gif-fade-time" className="text-xs text-stone-400 flex justify-between">
              <span>Fading Dauer</span>
              <span>{fadeTime.toFixed(1)}s</span>
            </label>
            <input
              id="gif-fade-time"
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={fadeTime}
              onChange={(e) => setFadeTime(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        )}
      </div>

      {/* GIF size estimate */}
      <div className="space-y-4 pt-2 border-t border-stone-700/50">
        <div className="bg-stone-900/50 p-2 rounded border border-stone-700/50">
          <div className="flex justify-between items-center text-xs">
            <span className="text-stone-400">Geschätzte Größe:</span>
            <span
              className={`font-mono ${gifSizeMB > 50 ? 'text-orange-400' : 'text-blue-400'}`}
            >
              ~{gifSizeMB.toFixed(1)} MB
            </span>
          </div>
          {gifSizeMB > 50 && (
            <p className="text-[10px] text-orange-500 mt-1 leading-tight">
              Achtung: Große GIFs können den Browser verlangsamen.
            </p>
          )}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={generateGIF}
        disabled={!canExport || isGenerating}
        aria-label={isGenerating ? `Generiere GIF, ${Math.round(progress * 100)}% abgeschlossen` : 'GIF speichern'}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-stone-700 disabled:text-stone-500 text-white p-3 rounded-lg flex justify-center items-center gap-2 transition-colors font-medium relative overflow-hidden text-sm"
      >
        {isGenerating ? (
          <>
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-500 opacity-50 transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
            <Loader2 size={20} className="animate-spin relative z-10" />
            <span className="relative z-10">
              Generiere... {Math.round(progress * 100)}%
            </span>
          </>
        ) : (
          <>
            <Download size={20} />
            GIF speichern
          </>
        )}
      </button>
    </div>
  );
}
