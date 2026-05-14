import { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageItem } from '../types';

interface UseImageAlignmentParams {
  images: ImageItem[];
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
  activeId: string | null;
  refId: string | null;
  containerWidth: number;
  worldWidth: number;
  zoomFactor: number;
  alignmentMode: 'manual' | 'points';
}

export function useImageAlignment({
  images,
  setImages,
  activeId,
  refId,
  containerWidth,
  worldWidth,
  zoomFactor,
  alignmentMode,
}: UseImageAlignmentParams) {
  // Drag/rotate/pinch state
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, mode: 'translate' as 'translate' | 'rotate' });
  const [initialImgPos, setInitialImgPos] = useState({ x: 0, y: 0, rot: 0, scale: 1 });
  const [initialPinch, setInitialPinch] = useState<{ distance: number; angle: number } | null>(null);

  // Point match zoom/pan state
  const [pointMatchZoom, setPointMatchZoom] = useState(1);
  const [pointMatchPan, setPointMatchPan] = useState({ x: 0, y: 0 });
  const [isPanningPoints, setIsPanningPoints] = useState(false);
  const [lastPointPanPos, setLastPointPanPos] = useState({ x: 0, y: 0 });

  // Point alignment state
  const [refPoints, setRefPoints] = useState<{ x: number; y: number }[]>([]);
  const [activePoints, setActivePoints] = useState<{ x: number; y: number }[]>([]);

  // Keep a mutable ref to the latest images so callbacks don't go stale
  const imagesRef = useRef<ImageItem[]>(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // ─── Core image update ────────────────────────────────────────────────────
  const updateActiveImage = useCallback((updates: Partial<ImageItem>) => {
    setImages((prev) => {
      const activeImg = prev.find((i) => i.id === activeId);
      if (!activeImg) return prev;

      const isRef = activeId === refId;

      return prev.map((img) => {
        if (img.id === activeId) {
          return { ...img, ...updates };
        }

        // If we move/scale/rotate the reference image, we move everything else too
        if (isRef) {
          const newImg = { ...img };
          if (updates.xFrac !== undefined) {
            newImg.xFrac += (updates.xFrac - activeImg.xFrac);
          }
          if (updates.yFrac !== undefined) {
            newImg.yFrac += (updates.yFrac - activeImg.yFrac);
          }
          if (updates.scale !== undefined) {
            const scaleRatio = updates.scale / activeImg.scale;
            newImg.scale *= scaleRatio;
            newImg.xFrac *= scaleRatio;
            newImg.yFrac *= scaleRatio;
          }
          if (updates.rotation !== undefined) {
            newImg.rotation += (updates.rotation - activeImg.rotation);
          }
          return newImg;
        }
        return img;
      });
    });
  }, [setImages, activeId, refId]);

  // ─── Reset all transformations ────────────────────────────────────────────
  const resetAllTransformations = useCallback(() => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        xFrac: 0,
        yFrac: 0,
        scale: 1,
        rotation: 0,
      }))
    );
  }, [setImages]);

  // ─── Point helpers ────────────────────────────────────────────────────────
  const addPointAtEvent = useCallback((e: React.MouseEvent | React.TouchEvent, target: 'ref' | 'active') => {
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      if (target === 'ref') {
        setRefPoints((prev) => [...prev, { x, y }]);
      } else {
        setActivePoints((prev) => [...prev, { x, y }]);
      }
    }
  }, []);

  const clearPoints = useCallback(() => {
    setRefPoints([]);
    setActivePoints([]);
  }, []);

  const resetPointMatchZoom = useCallback(() => {
    setPointMatchZoom(1);
    setPointMatchPan({ x: 0, y: 0 });
  }, []);

  // ─── Mouse handlers ───────────────────────────────────────────────────────
  const handleEditorMouseDown = useCallback((e: React.MouseEvent) => {
    if (!activeId) return;

    if (alignmentMode === 'points') {
      if (refPoints.length === activePoints.length) {
        addPointAtEvent(e, 'ref');
      } else {
        addPointAtEvent(e, 'active');
      }
      return;
    }

    if (e.button !== 0 && e.button !== 2) return;

    setIsDraggingImage(true);

    const activeImg = imagesRef.current.find((i) => i.id === activeId);
    if (!activeImg) return;

    setDragStart({
      x: e.clientX,
      y: e.clientY,
      mode: e.button === 0 ? 'translate' : 'rotate',
    });

    setInitialImgPos({
      x: activeImg.xFrac,
      y: activeImg.yFrac,
      rot: activeImg.rotation,
      scale: activeImg.scale,
    });
  }, [activeId, alignmentMode, refPoints.length, activePoints.length, addPointAtEvent]);

  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    if (alignmentMode === 'points' || !isDraggingImage || !containerWidth) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (dragStart.mode === 'rotate') {
      updateActiveImage({
        rotation: initialImgPos.rot + (dy * 0.5),
      });
    } else {
      updateActiveImage({
        xFrac: initialImgPos.x + dx / (worldWidth * zoomFactor),
        yFrac: initialImgPos.y + dy / (worldWidth * zoomFactor),
      });
    }
  }, [alignmentMode, isDraggingImage, containerWidth, dragStart, worldWidth, zoomFactor, initialImgPos, updateActiveImage]);

  const handleEditorMouseUp = useCallback(() => {
    setIsDraggingImage(false);
  }, []);

  // ─── Touch handlers ───────────────────────────────────────────────────────
  const handleEditorTouchStart = useCallback((e: React.TouchEvent) => {
    if (!activeId) return;
    setIsDraggingImage(true);

    const activeImg = imagesRef.current.find((i) => i.id === activeId);
    if (!activeImg) return;

    if (e.touches.length === 1) {
      setDragStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        mode: 'translate',
      });
      setInitialImgPos({
        x: activeImg.xFrac,
        y: activeImg.yFrac,
        rot: activeImg.rotation,
        scale: activeImg.scale,
      });
      setInitialPinch(null);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      setInitialPinch({ distance, angle });
      setInitialImgPos({
        x: activeImg.xFrac,
        y: activeImg.yFrac,
        rot: activeImg.rotation,
        scale: activeImg.scale,
      });
    }
  }, [activeId]);

  const handleEditorTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingImage || !containerWidth) return;

    const activeImg = imagesRef.current.find((i) => i.id === activeId);
    if (!activeImg) return;

    if (e.touches.length === 1 && dragStart.mode === 'translate') {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStart.x;
      const dy = e.touches[0].clientY - dragStart.y;
      updateActiveImage({
        xFrac: initialImgPos.x + dx / (worldWidth * zoomFactor),
        yFrac: initialImgPos.y + dy / (worldWidth * zoomFactor),
      });
    } else if (e.touches.length === 2 && initialPinch) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      const scaleChange = distance / initialPinch.distance;
      const angleChange = angle - initialPinch.angle;

      updateActiveImage({
        scale: Math.max(0.1, Math.min(10, initialImgPos.scale * scaleChange)),
        rotation: initialImgPos.rot + angleChange,
      });
    }
  }, [isDraggingImage, containerWidth, activeId, dragStart, worldWidth, zoomFactor, initialImgPos, initialPinch, updateActiveImage]);

  const handleEditorTouchEnd = useCallback(() => {
    setIsDraggingImage(false);
    setInitialPinch(null);
  }, []);

  // ─── Wheel handler ────────────────────────────────────────────────────────
  const handleEditorWheel = useCallback((e: React.WheelEvent) => {
    if (!activeId) return;
    e.preventDefault();

    const activeImg = imagesRef.current.find((i) => i.id === activeId);
    if (!activeImg) return;

    const scaleDelta = e.deltaY > 0 ? -0.05 : 0.05;
    const newScale = Math.max(0.1, Math.min(10, activeImg.scale + scaleDelta));

    updateActiveImage({ scale: newScale });
  }, [activeId, updateActiveImage]);

  // ─── Point match zoom/pan handlers ────────────────────────────────────────
  const handlePointMatchWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setPointMatchZoom((prev) => Math.max(1, Math.min(10, prev * delta)));
  }, []);

  const handlePointMatchMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && pointMatchZoom > 1 && e.altKey)) {
      setIsPanningPoints(true);
      setLastPointPanPos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [pointMatchZoom]);

  const handlePointMatchMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningPoints) {
      const dx = e.clientX - lastPointPanPos.x;
      const dy = e.clientY - lastPointPanPos.y;
      setPointMatchPan((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      setLastPointPanPos({ x: e.clientX, y: e.clientY });
    }
  }, [isPanningPoints, lastPointPanPos]);

  const handlePointMatchMouseUp = useCallback(() => {
    setIsPanningPoints(false);
  }, []);

  return {
    // Drag state
    isDraggingImage,
    // Point match state
    pointMatchZoom,
    pointMatchPan,
    isPanningPoints,
    // Point alignment state
    refPoints,
    activePoints,
    // Core actions
    updateActiveImage,
    resetAllTransformations,
    addPointAtEvent,
    clearPoints,
    resetPointMatchZoom,
    // Editor event handlers
    handleEditorMouseDown,
    handleEditorMouseMove,
    handleEditorMouseUp,
    handleEditorTouchStart,
    handleEditorTouchMove,
    handleEditorTouchEnd,
    handleEditorWheel,
    // Point match event handlers
    handlePointMatchWheel,
    handlePointMatchMouseDown,
    handlePointMatchMouseMove,
    handlePointMatchMouseUp,
  };
}
