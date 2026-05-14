import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Move, Settings2, Eye, X, Camera, RefreshCcw, Target, Crosshair, Trash2 } from 'lucide-react';

import type { ImageItem } from './types';

import ImageList from './components/ImageList';
import EditorCanvas from './components/EditorCanvas';
import PointMatcher from './components/PointMatcher';
import ExportPanel from './components/ExportPanel';
import { useCamera } from './hooks/useCamera';
import { useImageAlignment } from './hooks/useImageAlignment';
import { getAspectRatioValue } from './utils/imageHelpers';
import { autoAlignActiveImage, applyPointAlignment } from './utils/imageProcessing';
import { generateCollage as generateCollageUtil, generateGIF as generateGIFUtil } from './utils/export';

declare global {
  interface Window {
    gifshot?: import('./types').GifshotLib;
  }
}

export default function App() {
  // ─── Main state ───────────────────────────────────────────────────────────
  const [images, setImages] = useState<ImageItem[]>([]);
  const [refId, setRefId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [aspectRatio, setAspectRatio] = useState('original');
  const [opacity, setOpacity] = useState(50);
  const [edgeMode, setEdgeMode] = useState(false);
  const [edgeColor, setEdgeColor] = useState('#ffffff');
  const [edgeMaskAmount, setEdgeMaskAmount] = useState(100);
  const [edgeMaskShape, setEdgeMaskShape] = useState<'rect' | 'circle'>('rect');
  const [edgeMaskInvert, setEdgeMaskInvert] = useState(false);
  const [edgeThreshold, setEdgeThreshold] = useState(0);
  const [scaleStep, setScaleStep] = useState(0.01);
  const [rotationStep, setRotationStep] = useState(0.1);
  const [posStep, setPosStep] = useState(0.001);
  const [alignmentMode, setAlignmentMode] = useState<'manual' | 'points'>('manual');
  const [enablePointScale, setEnablePointScale] = useState(true);

  // Export state
  const [holdTime, setHoldTime] = useState(1.0);
  const [enableFading, setEnableFading] = useState(true);
  const [enableDeflickering, setEnableDeflickering] = useState(false);
  const [fadeTime, setFadeTime] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifQuality, setGifQuality] = useState(6);
  const [gifResolution, setGifResolution] = useState(0.5);

  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<ImageItem[]>(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const [containerWidth, setContainerWidth] = useState(0);

  // worldWidth uses the first uploaded image as the coordinate base unit
  const worldWidth = images.length > 0 ? images[0].width : 1000;
  const zoomFactor = containerWidth / worldWidth;

  // ─── Hooks ────────────────────────────────────────────────────────────────
  const { videoRef, isCameraActive, startCamera, stopCamera, capturePhoto } = useCamera();

  const {
    refPoints,
    activePoints,
    pointMatchZoom,
    pointMatchPan,
    isPanningPoints,
    updateActiveImage,
    resetAllTransformations,
    addPointAtEvent,
    clearPoints,
    resetPointMatchZoom,
    handleEditorMouseDown,
    handleEditorMouseMove,
    handleEditorMouseUp,
    handleEditorTouchStart,
    handleEditorTouchMove,
    handleEditorTouchEnd,
    handleEditorWheel,
    handlePointMatchWheel,
    handlePointMatchMouseDown,
    handlePointMatchMouseMove,
    handlePointMatchMouseUp,
  } = useImageAlignment({
    images,
    setImages,
    activeId,
    refId,
    containerWidth,
    worldWidth,
    zoomFactor,
    alignmentMode,
  });

  // ─── Effects ──────────────────────────────────────────────────────────────
  // Load gifshot library dynamically
  useEffect(() => {
    if (!window.gifshot) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gifshot/0.3.2/gifshot.min.js';
      document.body.appendChild(script);
    }
  }, []);

  // Update container width on window resize (bugfix #5: empty deps)
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', updateWidth);
    updateWidth();
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Cleanup: revoke all blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, []);

  // ─── Derived values ───────────────────────────────────────────────────────
  const refImage = images.find((i) => i.id === refId);
  const activeImage = images.find((i) => i.id === activeId);

  const imgAspect = refImage ? refImage.width / refImage.height : 1;
  const maskP = (100 - edgeMaskAmount) / 2;
  const maskPX = imgAspect > 1 ? maskP / imgAspect : maskP;
  const maskPY = imgAspect > 1 ? maskP : maskP * imgAspect;

  const maskR = edgeMaskAmount / 2;
  const maskRX = imgAspect > 1 ? maskR / imgAspect : maskR;
  const maskRY = imgAspect > 1 ? maskR : maskR * imgAspect;

  const targetRatio = getAspectRatioValue(aspectRatio);
  const containerAspect = targetRatio ? 1 / targetRatio : (refImage ? refImage.height / refImage.width : 1);

  // ─── Action handlers ──────────────────────────────────────────────────────
  const handleAutoAlign = async () => {
    if (!activeId || !refId || activeId === refId || !activeImage || !refImage) return;
    const result = await autoAlignActiveImage({
      refImage,
      activeImage,
      worldWidth,
      edgeMode,
      edgeThreshold,
    });
    if (result) {
      updateActiveImage(result);
    }
  };

  const handleApplyPointAlignment = () => {
    if (!activeImage || !refImage) return;
    const result = applyPointAlignment({
      refImage,
      activeImage,
      worldWidth,
      refPoints,
      activePoints,
      enablePointScale,
    });
    if (result) {
      updateActiveImage(result);
      clearPoints();
      setAlignmentMode('manual');
      resetPointMatchZoom();
    }
  };

  const handleGenerateCollage = async () => {
    setIsGenerating(true);
    setProgress(0);
    await generateCollageUtil({
      images,
      refId,
      aspectRatio,
      gifResolution,
      gifQuality,
      enableDeflickering,
    });
    setIsGenerating(false);
  };

  const handleGenerateGIF = async () => {
    setIsGenerating(true);
    setProgress(0);
    await generateGIFUtil({
      images,
      refId,
      aspectRatio,
      gifResolution,
      gifQuality,
      holdTime,
      enableFading,
      enableDeflickering,
      fadeTime,
      onProgress: setProgress,
    });
    setIsGenerating(false);
    setTimeout(() => setProgress(0), 1500);
  };

  const MAX_FILE_SIZE_MB = 20;
  const MAX_IMAGE_COUNT = 50;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      alert(`${oversized.length} Datei(en) überschreiten das Limit von ${MAX_FILE_SIZE_MB} MB und wurden übersprungen.`);
    }
    const validFiles = files.filter((f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);

    const remainingSlots = Math.max(0, MAX_IMAGE_COUNT - images.length);
    if (remainingSlots === 0) {
      alert(`Maximale Anzahl von ${MAX_IMAGE_COUNT} Bildern erreicht.`);
      return;
    }
    const filesToProcess = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      alert(`Nur die ersten ${remainingSlots} Dateien wurden hinzugefügt (Limit: ${MAX_IMAGE_COUNT} Bilder).`);
    }

    const newImages = await Promise.all(
      filesToProcess.map(async (file) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => {
            URL.revokeObjectURL(url);
            rej(new Error(`Failed to load image: ${file.name}`));
          };
        });
        return {
          id: Math.random().toString(36).slice(2, 11),
          file,
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
          xFrac: 0,
          yFrac: 0,
          scale: 1,
          rotation: 0,
        };
      })
    );

    setImages((prev) => [...prev, ...newImages]);
    if (newImages.length > 0) {
      setRefId((prev) => prev || newImages[0].id);
      setActiveId((prev) => prev || newImages[0].id);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });
    if (refId === id) setRefId(null);
    if (activeId === id) setActiveId(null);
  };

  const handleCapturePhoto = async () => {
    const photo = await capturePhoto();
    if (photo) {
      const newImg: ImageItem = {
        id: Math.random().toString(36).slice(2, 11),
        file: photo.file,
        url: photo.url,
        width: photo.width,
        height: photo.height,
        xFrac: 0,
        yFrac: 0,
        scale: 1,
        rotation: 0,
      };
      setImages((prev) => [...prev, newImg]);
      setActiveId(newImg.id);
      setRefId((prev) => prev || newImg.id);
      stopCamera();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-stone-900 text-stone-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-stone-800 border-r border-stone-700 flex flex-col z-20 max-h-screen md:max-h-none overflow-y-auto">
        <div className="p-4 border-b border-stone-700">
          <h1 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
            <ImageIcon className="text-emerald-500" />
            Timelapse Aligner
          </h1>
          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-lg flex justify-center items-center gap-2 transition-colors font-medium">
              <Upload size={20} />
              Bilder hochladen
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
            <button
              onClick={startCamera}
              className="bg-stone-700 hover:bg-stone-600 text-emerald-400 p-3 rounded-lg flex justify-center items-center transition-colors"
              title="Foto mit Kamera aufnehmen"
              aria-label="Foto mit Kamera aufnehmen"
            >
              <Camera size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <ImageList
          images={images}
          refId={refId}
          activeId={activeId}
          onSetRefId={setRefId}
          onSetActiveId={setActiveId}
          onRemoveImage={removeImage}
          onReorderImages={setImages}
          onResetAll={resetAllTransformations}
        />

        <ExportPanel
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          gifResolution={gifResolution}
          setGifResolution={setGifResolution}
          gifQuality={gifQuality}
          setGifQuality={setGifQuality}
          images={images}
          refId={refId}
          generateCollage={handleGenerateCollage}
          holdTime={holdTime}
          setHoldTime={setHoldTime}
          enableFading={enableFading}
          setEnableFading={setEnableFading}
          enableDeflickering={enableDeflickering}
          setEnableDeflickering={setEnableDeflickering}
          fadeTime={fadeTime}
          setFadeTime={setFadeTime}
          isGenerating={isGenerating}
          progress={progress}
          generateGIF={handleGenerateGIF}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col bg-stone-900 relative h-[100dvh]">
        {/* Toolbar */}
        <div className="bg-stone-800 p-4 flex flex-wrap gap-4 items-center border-b border-stone-700 shadow-md z-10 sticky top-0 md:relative">
          <div className="flex items-center gap-2 border-r border-stone-700 pr-3 mr-1">
            <button
              onClick={() => setAlignmentMode('manual')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors text-xs font-bold ${alignmentMode === 'manual' ? 'bg-emerald-600 text-white' : 'bg-stone-700 text-stone-400 hover:text-stone-200'}`}
              title="Manuelles Ausrichten"
            >
              <Move size={16} />
              <span className="hidden sm:inline">Manuell</span>
            </button>
            <button
              onClick={() => setAlignmentMode('points')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors text-xs font-bold ${alignmentMode === 'points' ? 'bg-blue-600 text-white' : 'bg-stone-700 text-stone-400 hover:text-stone-200'}`}
              title="Merkmals-Abgleich (Punkte)"
            >
              <Target size={16} />
              <span className="hidden sm:inline">Punkte-Match</span>
            </button>
          </div>

          {alignmentMode === 'manual' ? (
            <div className="flex items-center gap-4 transition-opacity duration-300">
              <div className="flex items-center gap-2">
                <Eye className="text-stone-400 flex-shrink-0" size={18} />
                <span className="text-sm font-medium hidden sm:inline">Overlay Deckkraft:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-24 sm:w-32 accent-emerald-500"
                />
                <span className="text-xs text-stone-400 w-8">{opacity}%</span>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-emerald-400 transition-colors shrink-0">
                <input
                  type="checkbox"
                  checked={edgeMode}
                  onChange={(e) => setEdgeMode(e.target.checked)}
                  className="rounded bg-stone-700 border-stone-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-stone-800"
                />
                <span className="hidden xs:inline">Kantenerkennung</span>
                <span className="xs:hidden">Kanten</span>
              </label>

              {edgeMode && (
                <div className="flex items-center gap-3 transition-all duration-300">
                  <input
                    type="color"
                    value={edgeColor}
                    onChange={(e) => setEdgeColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0 shrink-0"
                    title="Kantenfarbe wählen"
                  />

                  <div className="flex items-center gap-2 border-l border-stone-700 pl-3">
                    <button
                      onClick={() => setEdgeMaskShape('rect')}
                      className={`p-1.5 rounded transition-colors ${edgeMaskShape === 'rect' ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
                      title="Rechteckige Maske"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="12" height="12" /></svg>
                    </button>
                    <button
                      onClick={() => setEdgeMaskShape('circle')}
                      className={`p-1.5 rounded transition-colors ${edgeMaskShape === 'circle' ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
                      title="Kreisförmige Maske"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="6" /></svg>
                    </button>

                    <button
                      onClick={() => setEdgeMaskInvert(!edgeMaskInvert)}
                      className={`p-1.5 rounded transition-colors ${edgeMaskInvert ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
                      title="Maske invertieren"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18" /><path d="m8 8-4 4 4 4" /><path d="m16 16 4-4-4-4" /></svg>
                    </button>

                    <div className="flex items-center gap-2 ml-1">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={edgeMaskAmount}
                        onChange={(e) => setEdgeMaskAmount(Number(e.target.value))}
                        className="w-16 sm:w-24 accent-emerald-500"
                        title={`Masken-Größe: ${edgeMaskAmount}%`}
                      />
                      <span className="text-[10px] font-mono text-stone-400 w-7">{edgeMaskAmount}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-l border-stone-700 pl-3">
                    <span className="text-[10px] text-stone-400 whitespace-nowrap">Rauschfilter</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={edgeThreshold}
                      onChange={(e) => setEdgeThreshold(Number(e.target.value))}
                      className="w-16 sm:w-24 accent-emerald-500"
                      title={`Rauschfilter: ${edgeThreshold}%`}
                    />
                    <span className="text-[10px] font-mono text-stone-400 w-8">{edgeThreshold}%</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 transition-opacity duration-300">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-stone-400 hidden lg:inline">Punkt hinzufügen für:</span>
                <button
                  onClick={() => {}}
                  className="bg-blue-900/40 text-blue-300 px-3 py-1.5 rounded-lg border border-blue-700/50 text-[10px] sm:text-xs flex items-center gap-2 pointer-events-none"
                >
                  <Crosshair size={14} />
                  Auf Leinwand klicken
                </button>
                <div className="flex items-center gap-2 bg-stone-900/50 px-3 py-1.5 rounded-lg border border-stone-700/50">
                  <span className={`w-2 h-2 rounded-full ${refPoints.length > 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-stone-700'}`}></span>
                  <span className="text-[10px] sm:text-xs text-stone-300 font-mono">Ref: {refPoints.length}</span>
                  <span className="mx-1 text-stone-700">|</span>
                  <span className={`w-2 h-2 rounded-full ${activePoints.length > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-stone-700'}`}></span>
                  <span className="text-[10px] sm:text-xs text-stone-300 font-mono">Edit: {activePoints.length}</span>
                </div>
                <button
                  onClick={clearPoints}
                  className="text-stone-500 hover:text-red-400 transition-colors p-1.5 hover:bg-red-400/10 rounded-lg"
                  title="Alle Punkte löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button
                onClick={handleApplyPointAlignment}
                disabled={refPoints.length < 2 || activePoints.length < 2}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-stone-800 disabled:text-stone-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 transition-all text-xs font-bold shrink-0 shadow-lg shadow-blue-900/20 active:scale-95 border border-blue-400/30"
              >
                <Target size={14} />
                Match anwenden
              </button>
            </div>
          )}

          <div className="flex-1"></div>

          {activeImage && (
            <>
              <div className="h-6 w-px bg-stone-700 mx-1 hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <Settings2 className="text-stone-400 flex-shrink-0" size={18} />
                <span className="text-sm font-medium hidden lg:inline">Skalierung:</span>
                <button
                  onClick={() => updateActiveImage({ scale: Math.max(0.1, activeImage.scale - scaleStep) })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`-${scaleStep}`}
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.01"
                  value={activeImage.scale}
                  onChange={(e) => updateActiveImage({ scale: parseFloat(e.target.value) })}
                  className="w-20 sm:w-24 accent-emerald-500"
                />
                <button
                  onClick={() => updateActiveImage({ scale: Math.min(10, activeImage.scale + scaleStep) })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`+${scaleStep}`}
                >
                  +
                </button>
                <input
                  type="number"
                  min="0.001"
                  max="1"
                  step="0.001"
                  value={scaleStep}
                  onChange={(e) => setScaleStep(Math.max(0.001, parseFloat(e.target.value) || 0.01))}
                  className="w-12 h-6 text-[10px] text-center rounded bg-stone-800 border border-stone-600 text-stone-200 focus:border-emerald-500 focus:outline-none"
                  title="Schrittweite Skalierung"
                />
              </div>
              <div className="flex items-center gap-2">
                <RotateCwIcon size={18} className="text-stone-400 flex-shrink-0" />
                <span className="text-sm font-medium hidden lg:inline">Rotation:</span>
                <button
                  onClick={() => updateActiveImage({ rotation: Math.max(-180, activeImage.rotation - rotationStep) })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`-${rotationStep}`}
                >
                  -
                </button>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="0.01"
                  value={activeImage.rotation}
                  onChange={(e) => updateActiveImage({ rotation: parseFloat(e.target.value) })}
                  className="w-20 sm:w-24 accent-emerald-500"
                />
                <button
                  onClick={() => updateActiveImage({ rotation: Math.min(180, activeImage.rotation + rotationStep) })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`+${rotationStep}`}
                >
                  +
                </button>
                <input
                  type="number"
                  min="0.01"
                  max="10"
                  step="0.01"
                  value={rotationStep}
                  onChange={(e) => setRotationStep(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                  className="w-12 h-6 text-[10px] text-center rounded bg-stone-800 border border-stone-600 text-stone-200 focus:border-emerald-500 focus:outline-none"
                  title="Schrittweite Rotation"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium hidden lg:inline text-stone-400">X:</span>
                <button
                  onClick={() => updateActiveImage({ xFrac: activeImage.xFrac - posStep })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`-${posStep}`}
                >
                  -
                </button>
                <button
                  onClick={() => updateActiveImage({ xFrac: activeImage.xFrac + posStep })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`+${posStep}`}
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium hidden lg:inline text-stone-400">Y:</span>
                <button
                  onClick={() => updateActiveImage({ yFrac: activeImage.yFrac - posStep })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`-${posStep}`}
                >
                  -
                </button>
                <button
                  onClick={() => updateActiveImage({ yFrac: activeImage.yFrac + posStep })}
                  className="w-6 h-6 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                  title={`+${posStep}`}
                >
                  +
                </button>
                <input
                  type="number"
                  min="0.0001"
                  max="0.1"
                  step="0.0001"
                  value={posStep}
                  onChange={(e) => setPosStep(Math.max(0.0001, parseFloat(e.target.value) || 0.001))}
                  className="w-14 h-6 text-[10px] text-center rounded bg-stone-800 border border-stone-600 text-stone-200 focus:border-emerald-500 focus:outline-none"
                  title="Schrittweite Position"
                />
              </div>

              <div className="h-6 w-px bg-stone-700 mx-1 hidden lg:block"></div>

              <button
                onClick={handleAutoAlign}
                disabled={!activeId || activeId === refId}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors text-xs font-bold shrink-0 shadow-lg ring-1 ring-emerald-500/50"
                title="Bild automatisch am Referenzbild ausrichten"
              >
                <RefreshCcw size={14} />
                Auto-Align
              </button>
            </>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-auto p-4 flex flex-col md:flex-row justify-center items-center bg-stone-950 gap-4">
          {!refImage ? (
            <div className="text-stone-500 flex flex-col items-center gap-2 text-center">
              <ImageIcon size={48} className="opacity-20" />
              <p>Lade Bilder hoch und setze ein fixes Bild.</p>
            </div>
          ) : alignmentMode === 'points' && activeImage ? (
            <PointMatcher
              refImage={refImage}
              activeImage={activeImage}
              refPoints={refPoints}
              activePoints={activePoints}
              pointMatchZoom={pointMatchZoom}
              pointMatchPan={pointMatchPan}
              isPanningPoints={isPanningPoints}
              enablePointScale={enablePointScale}
              onAddPoint={addPointAtEvent}
              onWheel={handlePointMatchWheel}
              onMouseDown={handlePointMatchMouseDown}
              onMouseMove={handlePointMatchMouseMove}
              onMouseUp={handlePointMatchMouseUp}
              onMouseLeave={handlePointMatchMouseUp}
              onResetZoom={resetPointMatchZoom}
              onToggleScale={setEnablePointScale}
            />
          ) : (
            <EditorCanvas
              containerRef={containerRef}
              containerWidth={containerWidth}
              containerAspect={containerAspect}
              worldWidth={worldWidth}
              zoomFactor={zoomFactor}
              refImage={refImage}
              activeImage={activeImage}
              activeId={activeId}
              refId={refId}
              opacity={opacity}
              edgeMode={edgeMode}
              edgeColor={edgeColor}
              edgeThreshold={edgeThreshold}
              edgeMaskAmount={edgeMaskAmount}
              edgeMaskShape={edgeMaskShape}
              edgeMaskInvert={edgeMaskInvert}
              alignmentMode={alignmentMode}
              onMouseDown={handleEditorMouseDown}
              onMouseMove={handleEditorMouseMove}
              onMouseUp={handleEditorMouseUp}
              onWheel={handleEditorWheel}
              onTouchStart={handleEditorTouchStart}
              onTouchMove={handleEditorTouchMove}
              onTouchEnd={handleEditorTouchEnd}
            />
          )}
        </div>
      </div>

      {/* Camera overlay */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-black rounded-xl overflow-hidden shadow-2xl border border-stone-800">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full aspect-video object-cover"
            />

            {refImage && (
              <img
                src={refImage.url}
                alt="Ref Overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 mix-blend-screen"
                style={{
                  filter: edgeMode ? 'url(#edge-detect)' : 'none',
                  clipPath:
                    edgeMode && edgeMaskAmount < 100
                      ? edgeMaskShape === 'rect'
                        ? edgeMaskInvert
                          ? `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${maskPX}% ${maskPY}%, ${100 - maskPX}% ${maskPY}%, ${100 - maskPX}% ${100 - maskPY}%, ${maskPX}% ${100 - maskPY}%, ${maskPX}% ${maskPY}%)`
                          : `inset(${maskPY}% ${maskPX}%)`
                        : edgeMaskInvert
                          ? 'none'
                          : `ellipse(${maskRX}% ${maskRY}% at 50% 50%)`
                      : 'none',
                  WebkitMaskImage:
                    edgeMode && edgeMaskShape === 'circle' && edgeMaskInvert && edgeMaskAmount < 100
                      ? `radial-gradient(ellipse ${maskRX}% ${maskRY}% at 50% 50%, transparent 99%, black 100%)`
                      : 'none',
                  maskImage:
                    edgeMode && edgeMaskShape === 'circle' && edgeMaskInvert && edgeMaskAmount < 100
                      ? `radial-gradient(ellipse ${maskRX}% ${maskRY}% at 50% 50%, transparent 99%, black 100%)`
                      : 'none',
                }}
              />
            )}

            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
              <button
                onClick={stopCamera}
                className="bg-stone-800 hover:bg-stone-700 text-white p-4 rounded-full transition-colors shadow-lg border border-stone-700"
                aria-label="Kamera schließen"
              >
                <X size={24} aria-hidden="true" />
              </button>
              <button
                onClick={handleCapturePhoto}
                className="bg-emerald-600 hover:bg-emerald-500 text-white p-6 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl ring-4 ring-white/10"
                aria-label="Foto aufnehmen"
              >
                <Camera size={32} aria-hidden="true" />
              </button>
            </div>

            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-md">
              Kamera-Vorschau (mit Referenz-Overlay)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RotateCwIcon({ size = 18, className = 'text-stone-400' }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
