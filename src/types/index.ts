export interface ImageItem {
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

export interface GifshotResult {
  error: boolean;
  errorCode?: string;
  errorMsg?: string;
  image?: string;
}

export interface GifshotLib {
  createGIF: (
    options: Record<string, unknown>,
    callback: (obj: GifshotResult) => void
  ) => void;
}

declare global {
  interface Window {
    gifshot?: GifshotLib;
  }
}

export const ASPECT_RATIOS = [
  { label: 'Original', value: 'original' },
  { label: '1:1 Quadrat', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
] as const;

export type AspectRatioValue = (typeof ASPECT_RATIOS)[number]['value'];
