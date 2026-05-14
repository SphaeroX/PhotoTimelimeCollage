import React from 'react';
import { Target, Crosshair, ZoomIn, Maximize2 } from 'lucide-react';
import type { ImageItem } from '../types';

interface PointMatcherProps {
  refImage: ImageItem | undefined;
  activeImage: ImageItem | undefined;
  refPoints: { x: number; y: number }[];
  activePoints: { x: number; y: number }[];
  pointMatchZoom: number;
  pointMatchPan: { x: number; y: number };
  isPanningPoints: boolean;
  enablePointScale: boolean;
  onAddPoint: (e: React.MouseEvent, target: 'ref' | 'active') => void;
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onResetZoom: () => void;
  onToggleScale: (value: boolean) => void;
}

export default function PointMatcher({
  refImage,
  activeImage,
  refPoints,
  activePoints,
  pointMatchZoom,
  pointMatchPan,
  isPanningPoints,
  enablePointScale,
  onAddPoint,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onResetZoom,
  onToggleScale,
}: PointMatcherProps) {
  if (!refImage || !activeImage) return null;

  return (
    <div
      className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center p-4 group/pointmode"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="w-full h-full flex flex-col md:flex-row gap-4 transition-transform duration-75 ease-out select-none"
        style={{
          transform: `scale(${pointMatchZoom}) translate(${pointMatchPan.x / pointMatchZoom}px, ${pointMatchPan.y / pointMatchZoom}px)`,
          cursor: isPanningPoints ? 'grabbing' : (pointMatchZoom > 1 ? 'grab' : 'default'),
        }}
      >
        {/* Left Side: Reference Image */}
        <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
          <div className="flex justify-between items-center px-2">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              Referenz (Fix)
            </span>
            <span className="text-[10px] text-stone-500">
              {refImage.width}x{refImage.height}
            </span>
          </div>
          <div className="flex-1 bg-black rounded-xl border border-blue-500/30 overflow-hidden relative group flex items-center justify-center min-h-0">
            <div
              className="relative cursor-crosshair h-full max-w-full"
              style={{ aspectRatio: `${refImage.width}/${refImage.height}` }}
              onClick={(e) => !isPanningPoints && onAddPoint(e, 'ref')}
            >
              <img
                src={refImage.url}
                alt="Ref"
                className="w-full h-full object-contain pointer-events-none"
              />
              {refPoints.map((p, i) => (
                <div
                  key={`ref-${i}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  <Crosshair size={20 / pointMatchZoom} className="text-blue-500 drop-shadow-lg" />
                  <span
                    className="absolute bg-blue-600 text-white px-1 rounded-full font-bold shadow-lg"
                    style={{
                      top: `-${20 / pointMatchZoom}px`,
                      fontSize: `${Math.max(7, 9 / pointMatchZoom)}px`,
                      padding: `${Math.max(1, 2 / pointMatchZoom)}px`,
                    }}
                  >
                    R{i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Active Image */}
        <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
          <div className="flex justify-between items-center px-2">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              Edit (Aktiv)
            </span>
            <span className="text-[10px] text-stone-500">
              {activeImage.width}x{activeImage.height}
            </span>
          </div>
          <div className="flex-1 bg-black rounded-xl border border-emerald-500/30 overflow-hidden relative group flex items-center justify-center min-h-0">
            <div
              className="relative cursor-crosshair h-full max-w-full"
              style={{ aspectRatio: `${activeImage.width}/${activeImage.height}` }}
              onClick={(e) => !isPanningPoints && onAddPoint(e, 'active')}
            >
              <img
                src={activeImage.url}
                alt="Active"
                className="w-full h-full object-contain pointer-events-none"
              />
              {activePoints.map((p, i) => (
                <div
                  key={`active-${i}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  <Crosshair size={20 / pointMatchZoom} className="text-emerald-500 drop-shadow-lg" />
                  <span
                    className="absolute bg-emerald-600 text-white px-1 rounded-full font-bold shadow-lg"
                    style={{
                      top: `-${20 / pointMatchZoom}px`,
                      fontSize: `${Math.max(7, 9 / pointMatchZoom)}px`,
                      padding: `${Math.max(1, 2 / pointMatchZoom)}px`,
                    }}
                  >
                    E{i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Points Mode Status Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-900/90 text-white px-6 py-2.5 rounded-full text-xs border border-blue-500/50 backdrop-blur-md shadow-2xl flex items-center gap-4 z-50 transition-all duration-500">
        <Target size={18} className="text-blue-300 animate-pulse" />
        <div className="flex flex-col border-r border-blue-500/30 pr-4">
          <span className="font-bold tracking-wide uppercase text-[9px] text-blue-300 opacity-80">
            Nächster Schritt
          </span>
          <span className="text-sm">
            {refPoints.length === activePoints.length
              ? `Markiere Referenz-Punkt R${refPoints.length + 1} im linken Bild`
              : `Markiere entsprechenden Edit-Punkt E${activePoints.length + 1} im rechten Bild`}
          </span>
        </div>

        {/* Zoom Control Group */}
        <div className="flex items-center gap-4 border-r border-blue-500/30 pr-4">
          <div className="flex flex-col">
            <span className="font-bold tracking-wide uppercase text-[9px] text-blue-300 opacity-80">
              Ansicht
            </span>
            <div className="flex items-center gap-2">
              <ZoomIn size={14} className="text-blue-300" />
              <span className="text-xs font-mono">{Math.round(pointMatchZoom * 100)}%</span>
              {pointMatchZoom > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetZoom();
                  }}
                  className="p-1 bg-blue-700 hover:bg-blue-600 rounded transition-colors"
                  title="Zoom zurücksetzen"
                >
                  <Maximize2 size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="hidden lg:flex flex-col text-[8px] text-blue-200/60 leading-tight">
            <span>Wheel: Zoom</span>
            <span>Mid-Click: Pan</span>
            <span>Alt+Drag: Pan</span>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer hover:text-blue-200 transition-colors shrink-0">
          <div
            className={`w-8 h-4 rounded-full relative transition-colors ${
              enablePointScale ? 'bg-emerald-500' : 'bg-stone-600'
            }`}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={enablePointScale}
              onChange={(e) => onToggleScale(e.target.checked)}
            />
            <div
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
                enablePointScale ? 'left-[18px]' : 'left-[2px]'
              }`}
            ></div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight">Skalieren</span>
        </label>
      </div>
    </div>
  );
}
