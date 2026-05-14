import React from 'react';
import { Move, Settings2 } from 'lucide-react';
import type { ImageItem } from '../types';

interface EditorCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  containerWidth: number;
  containerAspect: number;
  worldWidth: number;
  zoomFactor: number;
  refImage: ImageItem | undefined;
  activeImage: ImageItem | undefined;
  activeId: string | null;
  refId: string | null;
  opacity: number;
  edgeMode: boolean;
  edgeColor: string;
  edgeThreshold: number;
  edgeMaskAmount: number;
  edgeMaskShape: 'rect' | 'circle';
  edgeMaskInvert: boolean;
  alignmentMode: 'manual' | 'points';
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

function RotateCwIcon({ size = 18, className = 'text-stone-400' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export default function EditorCanvas({
  containerRef,
  containerWidth,
  containerAspect,
  worldWidth,
  zoomFactor,
  refImage,
  activeImage,
  activeId,
  refId,
  opacity,
  edgeMode,
  edgeColor,
  edgeThreshold,
  edgeMaskAmount,
  edgeMaskShape,
  edgeMaskInvert,
  alignmentMode,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: EditorCanvasProps) {
  // ─── Edge-mask geometry ───────────────────────────────────────────────────
  const imgAspect = refImage ? refImage.width / refImage.height : 1;
  const maskP = (100 - edgeMaskAmount) / 2;
  const maskPX = imgAspect > 1 ? maskP / imgAspect : maskP;
  const maskPY = imgAspect > 1 ? maskP : maskP * imgAspect;

  const maskR = edgeMaskAmount / 2;
  const maskRX = imgAspect > 1 ? maskR / imgAspect : maskR;
  const maskRY = imgAspect > 1 ? maskR : maskR * imgAspect;

  // Convert hex colour to 0-1 RGB ratios for the SVG filter
  const edgeR = parseInt(edgeColor.slice(1, 3), 16) / 255;
  const edgeG = parseInt(edgeColor.slice(3, 5), 16) / 255;
  const edgeB = parseInt(edgeColor.slice(5, 7), 16) / 255;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* SVG edge-detection filter definition */}
      <svg className="hidden">
        <filter id="edge-detect">
          <feColorMatrix
            type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
            result="gray"
          />
          <feConvolveMatrix
            order="3 3"
            preserveAlpha="true"
            kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
            in="gray"
            result="edges"
          />
          <feComponentTransfer in="edges" result="thresholded">
            <feFuncR type="linear" intercept={-edgeThreshold / 100} />
            <feFuncG type="linear" intercept={-edgeThreshold / 100} />
            <feFuncB type="linear" intercept={-edgeThreshold / 100} />
          </feComponentTransfer>
          <feColorMatrix
            type="matrix"
            values={`0 0 0 0 ${edgeR}  0 0 0 0 ${edgeG}  0 0 0 0 ${edgeB}  5 0 0 0 0`}
            in="thresholded"
          />
        </filter>
      </svg>

      {/* Main editor canvas */}
      <div
        ref={containerRef}
        className="relative bg-black shadow-2xl ring-1 ring-stone-800 overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '800px',
          height: containerWidth ? containerWidth * containerAspect : '400px',
          touchAction: 'none',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Active image (background layer for alignment) */}
        {activeImage && (
          <img
            src={activeImage.url}
            alt="Active"
            draggable="false"
            className="absolute origin-center max-w-none max-h-none cursor-move"
            style={{
              width: `${activeImage.width * zoomFactor}px`,
              height: `${activeImage.height * zoomFactor}px`,
              left: '50%',
              top: '50%',
              transform: `
                translate(-50%, -50%)
                translate(${activeImage.xFrac * worldWidth * zoomFactor}px, ${activeImage.yFrac * worldWidth * zoomFactor}px)
                scale(${activeImage.scale})
                rotate(${activeImage.rotation}deg)
              `,
              opacity: activeId === refId ? 0 : 1,
              pointerEvents: activeId === refId ? 'none' : 'auto',
              zIndex: 10,
            }}
          />
        )}

        {/* Reference / overlay image (always on top) */}
        {refImage && (
          <img
            src={refImage.url}
            alt="Reference"
            draggable="false"
            className={`absolute origin-center max-w-none max-h-none ${
              activeId === refId ? 'cursor-move' : 'pointer-events-none'
            }`}
            style={{
              width: `${refImage.width * zoomFactor}px`,
              height: `${refImage.height * zoomFactor}px`,
              left: '50%',
              top: '50%',
              transform: `
                translate(-50%, -50%)
                translate(${refImage.xFrac * worldWidth * zoomFactor}px, ${refImage.yFrac * worldWidth * zoomFactor}px)
                scale(${refImage.scale})
                rotate(${refImage.rotation}deg)
              `,
              opacity: activeId === refId ? 1 : opacity / 100,
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
              mixBlendMode: 'normal',
              zIndex: 20,
            }}
          />
        )}

        {/* Bottom hint bar with keyboard shortcut hints */}
        {activeId && alignmentMode === 'manual' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-2 rounded-full text-[10px] sm:text-xs pointer-events-none flex items-center gap-3 sm:gap-4 backdrop-blur-sm shadow-lg whitespace-nowrap overflow-x-auto max-w-[95%]">
            <span className="flex items-center gap-1 shrink-0">
              <Move size={14} className="text-emerald-400" />{' '}
              <span className="hidden xs:inline">Bewegen</span>
              <span className="xs:hidden">Drag</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <RotateCwIcon size={14} className="text-emerald-400" />{' '}
              <span className="hidden xs:inline">Rotieren</span>
              <span className="xs:hidden">Rotate</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Settings2 size={14} className="text-emerald-400" />{' '}
              <span className="hidden xs:inline">Skalieren</span>
              <span className="xs:hidden">Scale</span>
            </span>
          </div>
        )}
      </div>
    </>
  );
}
