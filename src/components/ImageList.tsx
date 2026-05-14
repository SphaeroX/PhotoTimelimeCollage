import { useState } from 'react';
import { GripVertical, X, RefreshCcw } from 'lucide-react';
import type { ImageItem } from '../types';

interface ImageListProps {
  images: ImageItem[];
  refId: string | null;
  activeId: string | null;
  onSetRefId: (id: string) => void;
  onSetActiveId: (id: string) => void;
  onRemoveImage: (id: string) => void;
  onReorderImages: (newImages: ImageItem[]) => void;
  onResetAll: () => void;
}

export default function ImageList({
  images,
  refId,
  activeId,
  onSetRefId,
  onSetActiveId,
  onRemoveImage,
  onReorderImages,
  onResetAll,
}: ImageListProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    const newImages = [...images];
    const [removed] = newImages.splice(draggedIdx, 1);
    newImages.splice(index, 0, removed);
    onReorderImages(newImages);
    setDraggedIdx(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {images.map((img, idx) => (
        <div
          key={img.id}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, idx)}
          className={`p-2 rounded-lg border-2 flex items-center gap-3 bg-stone-900 cursor-grab active:cursor-grabbing ${
            activeId === img.id ? 'border-emerald-500' : 'border-stone-700'
          }`}
        >
          <GripVertical className="text-stone-500 flex-shrink-0" size={16} aria-hidden="true" />
          <img src={img.url} alt="" className="w-12 h-12 object-cover rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate text-stone-300">{img.file.name}</p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => onSetRefId(img.id)}
                className={`text-xs px-3 py-1.5 sm:px-2 sm:py-1 rounded font-medium ${
                  refId === img.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-stone-700 hover:bg-stone-600'
                }`}
                title="Als fixes Referenzbild setzen"
              >
                Fix
              </button>
              <button
                onClick={() => onSetActiveId(img.id)}
                className={`text-xs px-3 py-1.5 sm:px-2 sm:py-1 rounded font-medium ${
                  activeId === img.id
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'bg-stone-700 hover:bg-stone-600'
                }`}
                title="Zum Ausrichten auswählen"
              >
                Edit
              </button>
            </div>
          </div>
          <button
            onClick={() => onRemoveImage(img.id)}
            className="text-stone-500 hover:text-red-400 p-1"
            aria-label={`Bild entfernen: ${img.file.name}`}
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {images.length > 0 && (
        <button
          onClick={onResetAll}
          className="w-full mt-2 bg-stone-700 hover:bg-stone-600 text-stone-200 p-2 rounded-lg flex justify-center items-center gap-2 transition-colors text-sm"
          title="Reset all positions, rotations and scaling"
        >
          <RefreshCcw size={16} />
          Alle zurücksetzen
        </button>
      )}
    </div>
  );
}
