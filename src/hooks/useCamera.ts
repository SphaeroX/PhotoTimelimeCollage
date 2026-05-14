import { useState, useRef, useEffect, useCallback } from 'react';
import type { CapturedPhoto } from '../types';

export function useCamera() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup: stop camera stream when component unmounts
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setIsCameraActive(false);
      alert('Kamera-Zugriff verweigert oder nicht unterstützt.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const capturePhoto = useCallback((): Promise<CapturedPhoto | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) {
        resolve(null);
        return;
      }

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }

          const file = new File([blob], `camera_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          const url = URL.createObjectURL(file);

          resolve({
            file,
            url,
            width: canvas.width,
            height: canvas.height,
          });
        },
        'image/jpeg',
        0.9,
      );
    });
  }, []);

  return {
    videoRef,
    isCameraActive,
    startCamera,
    stopCamera,
    capturePhoto,
  };
}
