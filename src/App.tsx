import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Move, Settings2, Eye, Download, X, GripVertical, Film, Loader2, Layout, RefreshCcw, Crop, Camera, Square, Circle, FlipVertical, Target, Crosshair, Trash2, ZoomIn, Maximize2 } from 'lucide-react';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  xFrac: number;
  yFrac: number;
  scale: number;
  rotation: number;
}

const ASPECT_RATIOS = [
  { label: 'Original', value: 'original' },
  { label: '1:1 Quadrat', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
];

declare global {
  interface Window {
    gifshot: any;
  }
}

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [refId, setRefId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const [aspectRatio, setAspectRatio] = useState('original');
  const [opacity, setOpacity] = useState(50);
// ... rest of the file ...
  const [edgeMode, setEdgeMode] = useState(false);
  const [edgeColor, setEdgeColor] = useState('#ffffff');
  const [edgeMaskAmount, setEdgeMaskAmount] = useState(100);
  const [edgeMaskShape, setEdgeMaskShape] = useState<'rect' | 'circle'>('rect');
  const [edgeMaskInvert, setEdgeMaskInvert] = useState(false);
  const [edgeThreshold, setEdgeThreshold] = useState(0);
  
  const [alignmentMode, setAlignmentMode] = useState<'manual' | 'points'>('manual');
  const [refPoints, setRefPoints] = useState<{x: number, y: number}[]>([]);
  const [activePoints, setActivePoints] = useState<{x: number, y: number}[]>([]);
  const [enablePointScale, setEnablePointScale] = useState(true);
  
  // States for point matching zoom/pan UI (not affecting actual image alignment)
  const [pointMatchZoom, setPointMatchZoom] = useState(1);
  const [pointMatchPan, setPointMatchPan] = useState({ x: 0, y: 0 });
  const [isPanningPoints, setIsPanningPoints] = useState(false);
  const [lastPointPanPos, setLastPointPanPos] = useState({ x: 0, y: 0 });
  
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const worldWidth = images.length > 0 ? images[0].width : 1000;
  const zoomFactor = containerWidth / worldWidth;

  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, mode: 'translate' });
  const [initialImgPos, setInitialImgPos] = useState({ x: 0, y: 0, rot: 0, scale: 1 });
  const [initialPinch, setInitialPinch] = useState<{ distance: number; angle: number } | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // GIF Export Settings
  const [holdTime, setHoldTime] = useState(1.0);
  const [enableFading, setEnableFading] = useState(true);
  const [enableDeflickering, setEnableDeflickering] = useState(false);
  const [fadeTime, setFadeTime] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifQuality, setGifQuality] = useState(6); // 1-10 scale
  const [gifResolution, setGifResolution] = useState(0.5); // 0.1 - 1.0

  // Calculate estimated GIF size in MB
  const getEstimatedSize = () => {
    if (images.length === 0 || !refId) return 0;
    const refImgData = images.find((i) => i.id === refId);
    if (!refImgData) return 0;

    const fps = 10;
    const framesCountHold = Math.max(1, Math.round(holdTime * fps));
    const framesCountFade = enableFading ? Math.max(1, Math.round(fadeTime * fps)) : 0;
    const totalFrames = images.length * framesCountHold + (images.length - 1) * framesCountFade;

    const outWidth = Math.floor(refImgData.width * gifResolution);
    const outHeight = Math.floor(refImgData.height * gifResolution);
    
    // GIF estimation: roughly 0.15 bytes per pixel per frame (very rough heuristic)
    const qualityMultiplier = 0.1 + (gifQuality / 10) * 0.2;
    const sizeBytes = (outWidth * outHeight * totalFrames) * qualityMultiplier;
    return sizeBytes / (1024 * 1024);
  };

  const getEstimatedCollageSize = () => {
    if (images.length === 0 || !refId) return 0;
    const refImgData = images.find((i) => i.id === refId);
    if (!refImgData) return 0;

    const outWidth = Math.floor(refImgData.width * gifResolution);
    const targetRatio = getAspectRatioValue();
    const outHeight = Math.floor(targetRatio ? outWidth / targetRatio : refImgData.height * gifResolution);
    
    // PNG estimation: roughly 0.3 bytes per pixel (very rough heuristic)
    const sizeBytes = (outWidth * outHeight * images.length) * 0.3;
    return sizeBytes / (1024 * 1024);
  };

  // Load gifshot library dynamically
  useEffect(() => {
    if (!window.gifshot) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gifshot/0.3.2/gifshot.min.js';
      document.body.appendChild(script);
    }
  }, []);

  // Update container width on window resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', updateWidth);
    updateWidth();
    return () => window.removeEventListener('resize', updateWidth);
  }, [activeId, refId]);

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsCameraActive(false);
      alert("Kamera-Zugriff verweigert oder nicht unterstützt.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const url = URL.createObjectURL(file);
        const newImg: ImageItem = {
          id: Math.random().toString(36).substr(2, 9),
          file,
          url,
          width: canvas.width,
          height: canvas.height,
          xFrac: 0,
          yFrac: 0,
          scale: 1,
          rotation: 0,
        };
        setImages((prev) => {
          const updated = [...prev, newImg];
          if (!refId) setRefId(newImg.id);
          setActiveId(newImg.id);
          return updated;
        });
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = await Promise.all(
      files.map(async (file) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        await new Promise((res) => (img.onload = res));
        return {
          id: Math.random().toString(36).substr(2, 9),
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
    
    setImages((prev) => {
      const updated = [...prev, ...newImages];
      if (!refId && updated.length > 0) setRefId(updated[0].id);
      if (!activeId && updated.length > 0) setActiveId(updated[0].id);
      return updated;
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (refId === id) setRefId(null);
    if (activeId === id) setActiveId(null);
  };

  const onDragStartList = (index: number) => {
    setDraggedIdx(index);
  };

  const onDragOverList = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDropList = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    const newImgs = [...images];
    const [removed] = newImgs.splice(draggedIdx, 1);
    newImgs.splice(index, 0, removed);
    setImages(newImgs);
    setDraggedIdx(null);
  };

  const updateActiveImage = (updates: Partial<ImageItem>) => {
    setImages((prev) => {
      const activeImg = prev.find((i) => i.id === activeId);
      if (!activeImg) return prev;

      const isRef = activeId === refId;

      return prev.map((img) => {
        if (img.id === activeId) {
          return { ...img, ...updates };
        }
        
        // If we move/scale/rotate the reference image, we move everything else too
        // to maintain alignment (the "global crop" effect)
        if (isRef) {
          const newImg = { ...img };
          if (updates.xFrac !== undefined) {
            newImg.xFrac += (updates.xFrac - activeImg.xFrac);
          }
          if (updates.yFrac !== undefined) {
            newImg.yFrac += (updates.yFrac - activeImg.yFrac);
          }
          if (updates.scale !== undefined) {
            // Feature-consistent scaling from center
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
  };

  const getAspectRatioValue = () => {
    const found = ASPECT_RATIOS.find(r => r.value === aspectRatio);
    if (!found || found.value === 'original') return null;
    const [w, h] = found.value.split(':').map(Number);
    return w / h;
  };

  const autoAlignActiveImage = async () => {
    if (!activeId || !refId || activeId === refId || !activeImage || !refImage) return;

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res) => {
        const img = new Image();
        img.src = src;
        img.onload = () => res(img);
      });

    const [imgRef, imgAct] = await Promise.all([loadImg(refImage.url), loadImg(activeImage.url)]);
    
    const alignOnScale = (size: number, range: number, sx = 0, sy = 0, searchRotation = false) => {
      const c1 = document.createElement('canvas');
      const c2 = document.createElement('canvas');
      c1.width = c2.width = size;
      c1.height = c2.height = size;
      const ctx1 = c1.getContext('2d', { willReadFrequently: true });
      const ctx2 = c2.getContext('2d', { willReadFrequently: true });
      if (!ctx1 || !ctx2) return { x: 0, y: 0, rot: 0 };

      const draw = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, ox: number, oy: number, rot = 0) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);
        ctx.save();
        if (rot !== 0) {
          ctx.translate(size/2 + ox, size/2 + oy);
          ctx.rotate(rot * Math.PI / 180);
          ctx.translate(-(size/2 + ox), -(size/2 + oy));
        }
        const s = Math.min(size / img.width, size / img.height);
        ctx.drawImage(img, (size - img.width * s) / 2 + ox, (size - img.height * s) / 2 + oy, img.width * s, img.height * s);
        ctx.restore();
      };

      draw(ctx1, imgRef, 0, 0);
      const d1 = ctx1.getImageData(0, 0, size, size).data;
      
      // Calculate mean intensity for normalization (lighting robustness)
      let m1 = 0, cnt = 0;
      for (let i = 0; i < d1.length; i += 16) { m1 += d1[i]; cnt++; }
      m1 /= cnt;

      let bx = sx, by = sy, brot = 0, me = Infinity;

      // Small rotation search only on the first level for performance
      const rotations = searchRotation ? [-3, -1.5, 0, 1.5, 3] : [0];

      for (const rot of rotations) {
        for (let y = sy - range; y <= sy + range; y++) {
          for (let x = sx - range; x <= sx + range; x++) {
            draw(ctx2, imgAct, x, y, rot);
            const d2 = ctx2.getImageData(0, 0, size, size).data;
            
            let m2 = 0;
            for (let i = 0; i < d2.length; i += 16) m2 += d2[i];
            m2 /= cnt;
            const diffM = m1 - m2;

            let e = 0;
            for (let i = 0; i < d2.length; i += 16) {
              const d = (d1[i]) - (d2[i] + diffM); // Normalize by mean intensity
              e += d * d;
            }
            if (e < me) { me = e; bx = x; by = y; brot = rot; }
          }
        }
      }
      return { x: bx, y: by, rot: brot };
    };

    // Level 1: Coarse search (32px, +/- 12px range, with 3° rotation search)
    const c = alignOnScale(32, 12, 0, 0, true);
    // Level 2: Mid search (64px, +/- 6px range)
    const m = alignOnScale(64, 6, c.x * 2, c.y * 2);
    // Level 3: Fine search (128px, +/- 4px range)
    const f = alignOnScale(128, 4, m.x * 2, m.y * 2);

    // detected offset as fraction of world width
    // (since it was drawn object-contain on a square canvas, 128px maps to refImage.width)
    const dxRaw = (-f.x / 128) * (refImage.width / worldWidth);
    const dyRaw = (-f.y / 128) * (refImage.width / worldWidth);

    const totalRotation = refImage.rotation + c.rot;
    const rad = (totalRotation * Math.PI) / 180;
    const rotX = (dxRaw * Math.cos(rad) - dyRaw * Math.sin(rad)) * refImage.scale;
    const rotY = (dxRaw * Math.sin(rad) + dyRaw * Math.cos(rad)) * refImage.scale;

    updateActiveImage({
      xFrac: refImage.xFrac + rotX,
      yFrac: refImage.yFrac + rotY,
      rotation: totalRotation,
      scale: refImage.scale
    });
  };

  const applyPointAlignment = () => {
    if (refPoints.length < 2 || activePoints.length < 2 || !activeImage || !refImage) return;

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

    if (distQ === 0 || distP === 0) return;

    // 1. Calculate new scale and rotation relative to ref image's CURRENT state
    const scaleRatio = distP / distQ;
    const newScale = enablePointScale ? refImage.scale * scaleRatio : activeImage.scale;
    
    const angleDiff = (angleP - angleQ) * (180 / Math.PI);
    const newRotation = refImage.rotation + angleDiff;

    // 2. Calculate translation to align Q1 with P1 in container space
    // Let's find where P1 is relative to the container center (considering Ref transform)
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

    updateActiveImage({
      scale: newScale,
      rotation: newRotation,
      xFrac: newXFrac,
      yFrac: newYFrac
    });
    
    setRefPoints([]);
    setActivePoints([]);
    setAlignmentMode('manual');
    resetPointMatchZoom();
  };

  const addPointAtEvent = (e: React.MouseEvent | React.TouchEvent, target: 'ref' | 'active') => {
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Normalize to 0-1 range within the element
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // Only add point if it's within bounds
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      if (target === 'ref') {
        setRefPoints(prev => [...prev, { x, y }]);
      } else {
        setActivePoints(prev => [...prev, { x, y }]);
      }
    }
  };

  const resetAllTransformations = () => {
    setImages((prev) => 
      prev.map((img) => ({
        ...img,
        xFrac: 0,
        yFrac: 0,
        scale: 1,
        rotation: 0
      }))
    );
  };

  // Setup drag and rotation modes on mouse down
  const handleEditorMouseDown = (e: React.MouseEvent) => {
    if (!activeId) return;

    if (alignmentMode === 'points') {
      // Logic: If refPoints and activePoints are equal, add to ref. Else add to active.
      // This enforces pairs.
      if (refPoints.length === activePoints.length) {
        addPointAtEvent(e, 'ref');
      } else {
        addPointAtEvent(e, 'active');
      }
      return;
    }
    
    // 0 = Left click, 2 = Right click
    if (e.button !== 0 && e.button !== 2) return;
    
    setIsDraggingImage(true);
    
    const activeImg = images.find((i) => i.id === activeId);
    if (!activeImg) return;
    
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY,
      mode: e.button === 0 ? 'translate' : 'rotate'
    });
    
    setInitialImgPos({ 
      x: activeImg.xFrac, 
      y: activeImg.yFrac,
      rot: activeImg.rotation,
      scale: activeImg.scale
    });
  };

  // Handle translation or rotation based on mode
  const handleEditorMouseMove = (e: React.MouseEvent) => {
    if (alignmentMode === 'points' || !isDraggingImage || !containerWidth) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    if (dragStart.mode === 'rotate') {
      // 0.5 acts as rotation sensitivity modifier
      updateActiveImage({
        rotation: initialImgPos.rot + (dy * 0.5)
      });
    } else {
      updateActiveImage({
        xFrac: initialImgPos.x + dx / (worldWidth * zoomFactor),
        yFrac: initialImgPos.y + dy / (worldWidth * zoomFactor),
      });
    }
  };

  const handleEditorMouseUp = () => {
    setIsDraggingImage(false);
  };

  // Touch Handlers
  const handleEditorTouchStart = (e: React.TouchEvent) => {
    if (!activeId) return;
    setIsDraggingImage(true);

    const activeImg = images.find((i) => i.id === activeId);
    if (!activeImg) return;

    if (e.touches.length === 1) {
      setDragStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        mode: 'translate'
      });
      setInitialImgPos({
        x: activeImg.xFrac,
        y: activeImg.yFrac,
        rot: activeImg.rotation,
        scale: activeImg.scale
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
        scale: activeImg.scale
      });
    }
  };

  const handleEditorTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingImage || !containerWidth) return;
    // Don't prevent default if we want normal scrolling when not touching the canvas
    // But since it's the editor, we probably want to prevent scroll while manipulating images
    
    const activeImg = images.find((i) => i.id === activeId);
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
        rotation: initialImgPos.rot + angleChange
      });
    }
  };

  const handleEditorTouchEnd = () => {
    setIsDraggingImage(false);
    setInitialPinch(null);
  };

  // Add mouse wheel scaling
  const handleEditorWheel = (e: React.WheelEvent) => {
    if (!activeId) return;

    const activeImg = images.find((i) => i.id === activeId);
    if (!activeImg) return;

    // Determine scale direction
    const scaleDelta = e.deltaY > 0 ? -0.05 : 0.05;
    const newScale = Math.max(0.1, Math.min(10, activeImg.scale + scaleDelta));

    updateActiveImage({ scale: newScale });
  };

  const handlePointMatchWheel = (e: React.WheelEvent) => {
    // Zoom in/out of the point match view
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setPointMatchZoom(prev => Math.max(1, Math.min(10, prev * delta)));
  };

  const handlePointMatchMouseDown = (e: React.MouseEvent) => {
    // Start panning if middle mouse button or if it's a drag while zoomed
    if (e.button === 1 || (e.button === 0 && pointMatchZoom > 1 && e.altKey)) {
      setIsPanningPoints(true);
      setLastPointPanPos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handlePointMatchMouseMove = (e: React.MouseEvent) => {
    if (isPanningPoints) {
      const dx = e.clientX - lastPointPanPos.x;
      const dy = e.clientY - lastPointPanPos.y;
      setPointMatchPan(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setLastPointPanPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointMatchMouseUp = () => {
    setIsPanningPoints(false);
  };

  const resetPointMatchZoom = () => {
    setPointMatchZoom(1);
    setPointMatchPan({ x: 0, y: 0 });
  };
  const getAverageBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number, x = 0, y = 0) => {
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;
    let totalLuma = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Standard luma coefficients
      totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return totalLuma / (data.length / 4);
  };

  const generateCollage = async () => {
    if (images.length === 0 || !refId) return;
    const refImgData = images.find((i) => i.id === refId);
    if (!refImgData) return;

    const targetRatio = getAspectRatioValue();
    let baseWidth = refImgData.width * gifResolution;
    
    // Safety cap: Avoid extremely large exports that crash the browser
    const MAX_EXPORT_WIDTH = 1280;
    if (baseWidth > MAX_EXPORT_WIDTH) baseWidth = MAX_EXPORT_WIDTH;
    
    const outWidth = Math.floor(baseWidth);
    const outHeight = Math.floor(targetRatio ? baseWidth / targetRatio : refImgData.height * (outWidth / refImgData.width));

    const canvas = document.createElement('canvas');
    canvas.width = outWidth * images.length;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res) => {
        const img = new Image();
        img.src = src;
        img.onload = () => res(img);
      });

    let refBrightness = 128;
    if (enableDeflickering) {
      const refImg = await loadImg(refImgData.url);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 100; // Small scale for performance
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
      // Clip image to its slot
      ctx.beginPath();
      ctx.rect(i * outWidth, 0, outWidth, outHeight);
      ctx.clip();
      
      // Black background for the slot
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
          // Limit ratio to prevent extreme artifacts
          const clampedRatio = Math.max(0.5, Math.min(2.0, ratio));
          ctx.filter = `brightness(${clampedRatio})`;
        }
      }

      const slotCenterX = i * outWidth + outWidth / 2;
      const slotCenterY = outHeight / 2;

      // Ensure consistent logic with editor scaling
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
  };

  const generateGIF = async () => {
    if (images.length === 0 || !refId) return;
    if (!window.gifshot) {
      alert("GIF Encoder wird noch geladen. Bitte versuche es in wenigen Sekunden erneut.");
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    const refImgData = images.find((i) => i.id === refId);
    if (!refImgData) return;
    
    const targetRatio = getAspectRatioValue();
    let baseWidth = refImgData.width * gifResolution;
    
    // Safety cap: Avoid extremely large exports that crash the browser
    const MAX_EXPORT_WIDTH = 1280;
    if (baseWidth > MAX_EXPORT_WIDTH) baseWidth = MAX_EXPORT_WIDTH;
    
    const outWidth = Math.floor(baseWidth);
    const outHeight = Math.floor(targetRatio ? baseWidth / targetRatio : refImgData.height * (outWidth / refImgData.width));

    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res) => {
        const img = new Image();
        img.src = src;
        img.onload = () => res(img);
      });

    const loadedImages = await Promise.all(images.map(img => loadImg(img.url)));

    const brightnessRatios: Record<number, number> = {};
    if (enableDeflickering) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 100;
      tempCanvas.height = 100;
      const tctx = tempCanvas.getContext('2d');
      if (tctx) {
        // Use ref image as base
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

      // Ensure consistent logic with editor scaling
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

    // Map 1-10 quality to 0.5-1.0 JPEG quality
    const jpegQuality = 0.5 + (gifQuality / 10) * 0.5;

    // Generate all frames by drawing on canvas
    for (let i = 0; i < images.length; i++) {
      // Hold phase
      for (let h = 0; h < framesCountHold; h++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, outWidth, outHeight);
        drawImageScaled(i, 1);
        // Use PNG if quality is very high (safer for gifshot), otherwise JPEG
        frames.push(canvas.toDataURL(gifQuality > 8 ? 'image/png' : 'image/jpeg', jpegQuality));
      }

      // Fade phase to next image
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

    // gifshot quality: sampleInterval (lower is better, default is 10)
    // Map 1-10 quality to 20-2 sampleInterval
    const sampleInterval = 22 - (gifQuality * 2);

    try {
      // Pass frames to gifshot
      window.gifshot.createGIF({
        gifWidth: outWidth,
        gifHeight: outHeight,
        images: frames,
        interval: 1 / fps,
        sampleInterval: sampleInterval,
        progressCallback: (captureProgress: number) => {
          // Keep it at 99% during the heavy lifting to avoid "stuck at 100%" feel
          setProgress(Math.min(0.99, captureProgress));
        }
      }, function(obj: any) {
        if(!obj.error) {
          try {
            const link = document.createElement('a');
            link.download = 'timelapse.gif';
            link.href = obj.image;
            link.click();
            setProgress(1);
          } catch (e) {
            console.error("Link creation error", e);
            alert("Fehler beim Speichern des GIFs.");
          }
        } else {
          console.error("gifshot error:", obj.error, obj.errorCode, obj.errorMsg);
          alert(`Ein Fehler ist bei der GIF Generierung aufgetreten: ${obj.errorMsg || 'Unbekannter Fehler'}`);
        }
        setIsGenerating(false);
        // Reset progress after a delay to show 100% briefly
        setTimeout(() => setProgress(0), 1500);
      });
    } catch (err) {
      console.error("GIF generation crash:", err);
      alert("Kritischer Fehler bei der GIF-Erstellung. Reduziere ggf. die Auflösung.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const refImage = images.find((i) => i.id === refId);
  const activeImage = images.find((i) => i.id === activeId);

  const imgAspect = refImage ? refImage.width / refImage.height : 1;
  const maskP = (100 - edgeMaskAmount) / 2;
  const maskPX = imgAspect > 1 ? maskP / imgAspect : maskP;
  const maskPY = imgAspect > 1 ? maskP : maskP * imgAspect;
  
  const maskR = edgeMaskAmount / 2;
  const maskRX = imgAspect > 1 ? maskR / imgAspect : maskR;
  const maskRY = imgAspect > 1 ? maskR : maskR * imgAspect;

  const targetRatio = getAspectRatioValue();
  const containerAspect = targetRatio ? 1 / targetRatio : (refImage ? refImage.height / refImage.width : 1);

  // Convert hex color to rgb ratios for the SVG filter
  const edgeR = parseInt(edgeColor.slice(1, 3), 16) / 255;
  const edgeG = parseInt(edgeColor.slice(3, 5), 16) / 255;
  const edgeB = parseInt(edgeColor.slice(5, 7), 16) / 255;

  return (
    <div className="min-h-[100dvh] bg-stone-900 text-stone-100 flex flex-col md:flex-row font-sans">
      <svg className="hidden">
        <filter id="edge-detect">
          <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" result="gray"/>
          <feConvolveMatrix order="3 3" preserveAlpha="true" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" in="gray" result="edges"/>
          <feComponentTransfer in="edges" result="thresholded">
            <feFuncR type="linear" intercept={-edgeThreshold / 100} />
            <feFuncG type="linear" intercept={-edgeThreshold / 100} />
            <feFuncB type="linear" intercept={-edgeThreshold / 100} />
          </feComponentTransfer>
          <feColorMatrix type="matrix" values={`0 0 0 0 ${edgeR}  0 0 0 0 ${edgeG}  0 0 0 0 ${edgeB}  5 0 0 0 0`} in="thresholded" />
        </filter>
      </svg>

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
            >
              <Camera size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => onDragStartList(idx)}
              onDragOver={onDragOverList}
              onDrop={(e) => onDropList(e, idx)}
              className={`p-2 rounded-lg border-2 flex items-center gap-3 bg-stone-900 cursor-grab active:cursor-grabbing ${
                activeId === img.id ? 'border-emerald-500' : 'border-stone-700'
              }`}
            >
              <GripVertical className="text-stone-500 flex-shrink-0" size={16} />
              <img src={img.url} alt="thumb" className="w-12 h-12 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate text-stone-300">{img.file.name}</p>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setRefId(img.id)}
                    className={`text-xs px-3 py-1.5 sm:px-2 sm:py-1 rounded font-medium ${
                      refId === img.id ? 'bg-blue-600 text-white' : 'bg-stone-700 hover:bg-stone-600'
                    }`}
                    title="Als fixes Referenzbild setzen"
                  >
                    Fix
                  </button>
                  <button
                    onClick={() => setActiveId(img.id)}
                    className={`text-xs px-3 py-1.5 sm:px-2 sm:py-1 rounded font-medium ${
                      activeId === img.id ? 'border-emerald-500 bg-emerald-600 text-white' : 'bg-stone-700 hover:bg-stone-600'
                    }`}
                    title="Zum Ausrichten auswählen"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <button onClick={() => removeImage(img.id)} className="text-stone-500 hover:text-red-400 p-1">
                <X size={16} />
              </button>
            </div>
          ))}
          
          {images.length > 0 && (
            <button
              onClick={resetAllTransformations}
              className="w-full mt-2 bg-stone-700 hover:bg-stone-600 text-stone-200 p-2 rounded-lg flex justify-center items-center gap-2 transition-colors text-sm"
              title="Reset all positions, rotations and scaling"
            >
              <RefreshCcw size={16} />
              Alle zurücksetzen
            </button>
          )}
        </div>

        <div className="p-4 border-t border-stone-700 flex flex-col gap-4 bg-stone-850 overflow-y-auto max-h-[50vh]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Crop size={18} className="text-emerald-400" />
              <h3 className="font-semibold text-sm">Leinwand & Format</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => setAspectRatio(ratio.value)}
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

          <div className="h-px w-full bg-stone-700 my-1"></div>

          <div className="flex items-center gap-2 text-stone-300">
            <Settings2 size={18} className="text-emerald-400" />
            <h3 className="font-semibold text-sm">Export-Einstellungen</h3>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400 flex justify-between">
                <span>Auflösung (Skalierung)</span>
                <span>{Math.round(gifResolution * 100)}%</span>
              </label>
              <input
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
              <label className="text-xs text-stone-400 flex justify-between">
                <span>Qualität (Kompression)</span>
                <span>{gifQuality} / 10</span>
              </label>
              <input
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

          <div className="h-px w-full bg-stone-700 my-1"></div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-stone-300">
              <Layout size={18} className="text-emerald-400" />
              <h3 className="font-semibold text-sm">Collage Export</h3>
            </div>
            
            <div className="bg-stone-900/50 p-2 rounded border border-stone-700/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400">Geschätzte Größe:</span>
                <span className="font-mono text-emerald-400">
                  ~{getEstimatedCollageSize().toFixed(1)} MB
                </span>
              </div>
            </div>

            <button
              onClick={generateCollage}
              disabled={images.length < 2 || !refId}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-500 text-white p-3 rounded-lg flex justify-center items-center gap-2 transition-colors font-medium text-sm"
            >
              <Download size={18} />
              Collage speichern
            </button>
          </div>

          <div className="h-px w-full bg-stone-700 my-1"></div>

          <div className="flex items-center gap-2 text-stone-300">
            <Film size={18} className="text-blue-400" />
            <h3 className="font-semibold text-sm">GIF Export</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-400 flex justify-between">
                <span>Anzeigedauer pro Bild</span>
                <span>{holdTime.toFixed(1)}s</span>
              </label>
              <input
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

              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-400 transition-colors" title="Passt die Helligkeit der Bilder an das Referenzbild an">
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
                <label className="text-xs text-stone-400 flex justify-between">
                  <span>Fading Dauer</span>
                  <span>{fadeTime.toFixed(1)}s</span>
                </label>
                <input
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

          <div className="space-y-4 pt-2 border-t border-stone-700/50">
            <div className="bg-stone-900/50 p-2 rounded border border-stone-700/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400">Geschätzte Größe:</span>
                <span className={`font-mono ${getEstimatedSize() > 50 ? 'text-orange-400' : 'text-blue-400'}`}>
                  ~{getEstimatedSize().toFixed(1)} MB
                </span>
              </div>
              {getEstimatedSize() > 50 && (
                <p className="text-[10px] text-orange-500 mt-1 leading-tight">
                  Achtung: Große GIFs können den Browser verlangsamen.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={generateGIF}
            disabled={images.length < 2 || !refId || isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-stone-700 disabled:text-stone-500 text-white p-3 rounded-lg flex justify-center items-center gap-2 transition-colors font-medium relative overflow-hidden text-sm"
          >
            {isGenerating ? (
              <>
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-blue-500 opacity-50 transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                ></div>
                <Loader2 size={20} className="animate-spin relative z-10" />
                <span className="relative z-10">Generiere... {Math.round(progress * 100)}%</span>
              </>
            ) : (
              <>
                <Download size={20} />
                GIF speichern
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-stone-900 relative h-[100dvh]">
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
            <div className="flex items-center gap-4 animate-in fade-in duration-300">
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
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
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
                      <Square size={14} />
                    </button>
                    <button 
                      onClick={() => setEdgeMaskShape('circle')}
                      className={`p-1.5 rounded transition-colors ${edgeMaskShape === 'circle' ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
                      title="Kreisförmige Maske"
                    >
                      <Circle size={14} />
                    </button>
                    
                    <button 
                      onClick={() => setEdgeMaskInvert(!edgeMaskInvert)}
                      className={`p-1.5 rounded transition-colors ${edgeMaskInvert ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
                      title="Maske invertieren"
                    >
                      <FlipVertical size={14} />
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
            <div className="flex items-center gap-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-stone-400 hidden lg:inline">Punkt hinzufügen für:</span>
                <button 
                  onClick={() => {}} // Placeholder, logic handled on canvas
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
                  onClick={() => { setRefPoints([]); setActivePoints([]); }}
                  className="text-stone-500 hover:text-red-400 transition-colors p-1.5 hover:bg-red-400/10 rounded-lg"
                  title="Alle Punkte löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button
                onClick={applyPointAlignment}
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
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.01"
                  value={activeImage.scale}
                  onChange={(e) => updateActiveImage({ scale: parseFloat(e.target.value) })}
                  className="w-20 sm:w-24 accent-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <RotateCwIcon size={18} className="text-stone-400 flex-shrink-0" />
                <span className="text-sm font-medium hidden lg:inline">Rotation:</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={activeImage.rotation}
                  onChange={(e) => updateActiveImage({ rotation: parseFloat(e.target.value) })}
                  className="w-20 sm:w-24 accent-emerald-500"
                />
              </div>

              <div className="h-6 w-px bg-stone-700 mx-1 hidden lg:block"></div>
              
              <button
                onClick={autoAlignActiveImage}
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

        <div className="flex-1 overflow-auto p-4 flex flex-col md:flex-row justify-center items-center bg-stone-950 gap-4">
          {!refImage ? (
            <div className="text-stone-500 flex flex-col items-center gap-2 text-center">
              <ImageIcon size={48} className="opacity-20" />
              <p>Lade Bilder hoch und setze ein fixes Bild.</p>
            </div>
          ) : alignmentMode === 'points' && activeImage ? (
            <div 
              className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center p-4 group/pointmode"
              onWheel={handlePointMatchWheel}
              onMouseDown={handlePointMatchMouseDown}
              onMouseMove={handlePointMatchMouseMove}
              onMouseUp={handlePointMatchMouseUp}
              onMouseLeave={handlePointMatchMouseUp}
            >
              <div 
                className="w-full h-full flex flex-col md:flex-row gap-4 transition-transform duration-75 ease-out select-none"
                style={{ 
                  transform: `scale(${pointMatchZoom}) translate(${pointMatchPan.x / pointMatchZoom}px, ${pointMatchPan.y / pointMatchZoom}px)`,
                  cursor: isPanningPoints ? 'grabbing' : (pointMatchZoom > 1 ? 'grab' : 'default')
                }}
              >
                {/* Left Side: Reference Image */}
                <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      Referenz (Fix)
                    </span>
                    <span className="text-[10px] text-stone-500">{refImage.width}x{refImage.height}</span>
                  </div>
                  <div className="flex-1 bg-black rounded-xl border border-blue-500/30 overflow-hidden relative group flex items-center justify-center min-h-0">
                    <div 
                      className="relative cursor-crosshair h-full max-w-full"
                      style={{ aspectRatio: `${refImage.width}/${refImage.height}` }}
                      onClick={(e) => !isPanningPoints && addPointAtEvent(e, 'ref')}
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
                              padding: `${Math.max(1, 2 / pointMatchZoom)}px`
                            }}
                          >R{i+1}</span>
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
                    <span className="text-[10px] text-stone-500">{activeImage.width}x{activeImage.height}</span>
                  </div>
                  <div className="flex-1 bg-black rounded-xl border border-emerald-500/30 overflow-hidden relative group flex items-center justify-center min-h-0">
                    <div 
                      className="relative cursor-crosshair h-full max-w-full"
                      style={{ aspectRatio: `${activeImage.width}/${activeImage.height}` }}
                      onClick={(e) => !isPanningPoints && addPointAtEvent(e, 'active')}
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
                              padding: `${Math.max(1, 2 / pointMatchZoom)}px`
                            }}
                          >E{i+1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Points Mode Status Bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-900/90 text-white px-6 py-2.5 rounded-full text-xs border border-blue-500/50 backdrop-blur-md shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4 duration-500">
                <Target size={18} className="text-blue-300 animate-pulse" />
                <div className="flex flex-col border-r border-blue-500/30 pr-4">
                  <span className="font-bold tracking-wide uppercase text-[9px] text-blue-300 opacity-80">Nächster Schritt</span>
                  <span className="text-sm">
                    {refPoints.length === activePoints.length 
                      ? `Markiere Referenz-Punkt R${refPoints.length + 1} im linken Bild` 
                      : `Markiere entsprechenden Edit-Punkt E${activePoints.length + 1} im rechten Bild`}
                  </span>
                </div>

                {/* Zoom Control Group */}
                <div className="flex items-center gap-4 border-r border-blue-500/30 pr-4">
                  <div className="flex flex-col">
                    <span className="font-bold tracking-wide uppercase text-[9px] text-blue-300 opacity-80">Ansicht</span>
                    <div className="flex items-center gap-2">
                      <ZoomIn size={14} className="text-blue-300" />
                      <span className="text-xs font-mono">{Math.round(pointMatchZoom * 100)}%</span>
                      {pointMatchZoom > 1 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); resetPointMatchZoom(); }}
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
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${enablePointScale ? 'bg-emerald-500' : 'bg-stone-600'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={enablePointScale}
                      onChange={(e) => setEnablePointScale(e.target.checked)}
                    />
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${enablePointScale ? 'left-4.5' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tight">Skalieren</span>
                </label>
              </div>
            </div>
          ) : (
            <div 
              ref={containerRef}
              className="relative bg-black shadow-2xl ring-1 ring-stone-800 overflow-hidden"
              style={{
                width: '100%',
                maxWidth: '800px',
                height: containerWidth ? containerWidth * containerAspect : '400px',
                touchAction: 'none' // Prevent scrolling while touching the canvas
              }}
              onMouseDown={handleEditorMouseDown}
              onMouseMove={handleEditorMouseMove}
              onMouseUp={handleEditorMouseUp}
              onMouseLeave={handleEditorMouseUp}
              onWheel={handleEditorWheel}
              onTouchStart={handleEditorTouchStart}
              onTouchMove={handleEditorTouchMove}
              onTouchEnd={handleEditorTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
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
                    // Hide the active image if it is the ref image to avoid double rendering with filter/opacity
                    opacity: activeId === refId ? 0 : 1,
                    pointerEvents: activeId === refId ? 'none' : 'auto',
                    zIndex: 10 // Active image is the background for alignment
                  }}
                />
              )}

              {refImage && (
                <img
                  src={refImage.url}
                  alt="Reference"
                  draggable="false"
                  className={`absolute origin-center max-w-none max-h-none ${activeId === refId ? 'cursor-move' : 'pointer-events-none'}`}
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
                    // When editing the ref image, show it fully. Otherwise show as overlay.
                    opacity: activeId === refId ? 1 : opacity / 100,
                    filter: edgeMode ? 'url(#edge-detect)' : 'none',
                    clipPath: edgeMode && edgeMaskAmount < 100 
                      ? (edgeMaskShape === 'rect' 
                          ? (edgeMaskInvert 
                              ? `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${maskPX}% ${maskPY}%, ${100 - maskPX}% ${maskPY}%, ${100 - maskPX}% ${100 - maskPY}%, ${maskPX}% ${100 - maskPY}%, ${maskPX}% ${maskPY}%)`
                              : `inset(${maskPY}% ${maskPX}%)`)
                          : (edgeMaskInvert ? 'none' : `ellipse(${maskRX}% ${maskRY}% at 50% 50%)`))
                      : 'none',
                    WebkitMaskImage: edgeMode && edgeMaskShape === 'circle' && edgeMaskInvert && edgeMaskAmount < 100
                      ? `radial-gradient(ellipse ${maskRX}% ${maskRY}% at 50% 50%, transparent 99%, black 100%)`
                      : 'none',
                    maskImage: edgeMode && edgeMaskShape === 'circle' && edgeMaskInvert && edgeMaskAmount < 100
                      ? `radial-gradient(ellipse ${maskRX}% ${maskRY}% at 50% 50%, transparent 99%, black 100%)`
                      : 'none',
                    mixBlendMode: 'normal',
                    zIndex: 20 // Reference/Overlay is always on top
                  }}
                />
              )}
              
              {activeId && alignmentMode === 'manual' && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-2 rounded-full text-[10px] sm:text-xs pointer-events-none flex items-center gap-3 sm:gap-4 backdrop-blur-sm shadow-lg whitespace-nowrap overflow-x-auto max-w-[95%]">
                  <span className="flex items-center gap-1 shrink-0"><Move size={14} className="text-emerald-400" /> <span className="hidden xs:inline">Bewegen</span><span className="xs:hidden">Drag</span></span>
                  <span className="flex items-center gap-1 shrink-0"><RotateCwIcon size={14} className="text-emerald-400" /> <span className="hidden xs:inline">Rotieren</span><span className="xs:hidden">Rotate</span></span>
                  <span className="flex items-center gap-1 shrink-0"><Settings2 size={14} className="text-emerald-400" /> <span className="hidden xs:inline">Skalieren</span><span className="xs:hidden">Scale</span></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {isCameraActive && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-black rounded-xl overflow-hidden shadow-2xl border border-stone-800">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full aspect-video object-cover"
            />
            
            {/* Overlay for alignment in camera view */}
            {refImage && (
              <img
                src={refImage.url}
                alt="Ref Overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 mix-blend-screen"
                style={{ 
                  filter: edgeMode ? 'url(#edge-detect)' : 'none',
                  clipPath: edgeMode && edgeMaskAmount < 100 
                    ? (edgeMaskShape === 'rect' 
                        ? (edgeMaskInvert 
                            ? `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${maskPX}% ${maskPY}%, ${100 - maskPX}% ${maskPY}%, ${100 - maskPX}% ${100 - maskPY}%, ${maskPX}% ${100 - maskPY}%, ${maskPX}% ${maskPY}%)`
                            : `inset(${maskPY}% ${maskPX}%)`)
                        : (edgeMaskInvert ? 'none' : `ellipse(${maskRX}% ${maskRY}% at 50% 50%)`))
                    : 'none',
                  WebkitMaskImage: edgeMode && edgeMaskShape === 'circle' && edgeMaskInvert && edgeMaskAmount < 100
                    ? `radial-gradient(ellipse ${maskRX}% ${maskRY}% at 50% 50%, transparent 99%, black 100%)`
                    : 'none',
                  maskImage: edgeMode && edgeMaskShape === 'circle' && edgeMaskInvert && edgeMaskAmount < 100
                    ? `radial-gradient(ellipse ${maskRX}% ${maskRY}% at 50% 50%, transparent 99%, black 100%)`
                    : 'none'
                }}
              />
            )}

            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
              <button 
                onClick={stopCamera}
                className="bg-stone-800 hover:bg-stone-700 text-white p-4 rounded-full transition-colors shadow-lg border border-stone-700"
              >
                <X size={24} />
              </button>
              <button 
                onClick={capturePhoto}
                className="bg-emerald-600 hover:bg-emerald-500 text-white p-6 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl ring-4 ring-white/10"
              >
                <Camera size={32} />
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

function RotateCwIcon({ size = 18, className = "text-stone-400" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
    </svg>
  );
}
