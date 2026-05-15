import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Move } from "lucide-react";

export function ImageCropperModal({ 
  file, 
  onCrop, 
  onCancel,
  title = "Crop Profile Photo"
}: { 
  file: File, 
  onCrop: (file: File) => void, 
  onCancel: () => void,
  title?: string
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialOffsetRef = useRef({ x: 0, y: 0 });
  const pinchDistanceRef = useRef(0);
  
  const [objectUrl, setObjectUrl] = useState("");
  
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(Math.max(1, prev - e.deltaY * 0.005), 5));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialOffsetRef.current = { ...offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: initialOffsetRef.current.x + dx,
      y: initialOffsetRef.current.y + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - pinchDistanceRef.current;
      setZoom(prev => Math.min(Math.max(1, prev + delta * 0.02), 5));
      pinchDistanceRef.current = dist;
    }
  };

  const applyCrop = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const outSize = Math.min(img.width, img.height);
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const scale = 1 / zoom;
        const srcSize = outSize * scale;
        
        const cx = img.width / 2;
        const cy = img.height / 2;
        
        const offsetScale = outSize / 192; // 192px is w-48 container size
        const adjX = cx - (srcSize / 2) - (offset.x * offsetScale / zoom);
        const adjY = cy - (srcSize / 2) - (offset.y * offsetScale / zoom);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outSize, outSize);
        
        ctx.drawImage(img, adjX, adjY, srcSize, srcSize, 0, 0, outSize, outSize);
        
        canvas.toBlob((blob) => {
          if (blob) {
            onCrop(new File([blob], file.name, { type: file.type || 'image/jpeg' }));
          }
        }, file.type || 'image/jpeg');
      }
    };
    img.src = objectUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm touch-none">
      <Card className="w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4 bg-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0 rounded-full">✕</Button>
        </div>
        
        <div className="flex justify-center p-4 bg-muted/50 rounded-lg border border-border">
          <div 
            className="w-48 h-48 rounded-full border-4 border-[var(--brand)] shadow-sm overflow-hidden relative cursor-move bg-background"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            style={{ touchAction: 'none' }}
          >
            {objectUrl && (
              <img 
                src={objectUrl} 
                alt="Crop Preview" 
                className="absolute max-w-none pointer-events-none origin-center"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
                }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none opacity-30">
              <div className="w-full h-1/3 border-b border-white" />
              <div className="w-full h-1/3 border-b border-white" />
              <div className="absolute top-0 left-1/3 w-1/3 h-full border-l border-r border-white" />
            </div>
          </div>
        </div>
        
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1"><ZoomOut size={14} /> Zoom</span>
            <span className="flex items-center gap-1"><Move size={14} /> Pan</span>
            <span className="flex items-center gap-1">Zoom <ZoomIn size={14} /></span>
          </div>
          <input 
            type="range" min="1" max="4" step="0.05" 
            value={zoom} 
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-[var(--brand)] h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
          <p className="text-[11px] text-center text-muted-foreground mt-2">Pinch or scroll to zoom, drag to pan</p>
        </div>
        
        <div className="flex gap-2 pt-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1 bg-[var(--brand)] text-white hover:opacity-90" onClick={applyCrop}>Apply Crop</Button>
        </div>
      </Card>
    </div>
  );
}