"use client";
import { useState, useEffect, useRef } from "react";
import ProductImage from "@/components/catalog/ProductImage";
import type { CatalogProduct } from "../../../supabase/functions/_shared/contracts";

type ProductImageType = CatalogProduct["images"][number];

interface ProductImageModalProps {
  isOpen: boolean;
  images: ProductImageType[];
  currentIndex: number;
  onClose: () => void;
  onImageChange: (index: number) => void;
}

export default function ProductImageModal({
  isOpen,
  images,
  currentIndex,
  onClose,
  onImageChange,
}: ProductImageModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(currentIndex);

  // Reset zoom when image changes
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        onImageChange(
          currentIndex === 0 ? images.length - 1 : currentIndex - 1
        );
      } else if (e.key === "ArrowRight") {
        onImageChange(
          currentIndex === images.length - 1 ? 0 : currentIndex + 1
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, images.length, onImageChange, onClose]);

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(1, Math.min(3, z + delta)));
  };

  // Handle mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoom === 1) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Limit panning
    const maxX = (zoom - 1) * (containerRef.current?.offsetWidth || 0) * 0.5;
    const maxY = (zoom - 1) * (containerRef.current?.offsetHeight || 0) * 0.5;

    setPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen) return null;

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  return (
    <div
      className="bg-opacity-90 fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white text-white transition-colors hover:bg-white hover:text-black"
        onClick={onClose}
        aria-label="Cerrar modal"
      >
        ✕
      </button>

      {/* Main image container */}
      <div
        ref={containerRef}
        className="relative h-full max-h-[90vh] w-full max-w-[90vw] cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ userSelect: "none" }}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: "center",
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          <ProductImage
            unoptimized
            className="max-h-full max-w-full object-contain"
            src={currentImage.url || "/images/hero-editorial.svg"}
            alt={currentImage.alt || "Producto ampliado"}
            sizes="90vw"
          />
        </div>
      </div>

      {/* Navigation - Previous */}
      {images.length > 1 && (
        <button
          className="absolute top-1/2 left-4 z-40 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white text-white transition-colors hover:bg-white hover:text-black"
          onClick={() =>
            onImageChange(
              currentIndex === 0 ? images.length - 1 : currentIndex - 1
            )
          }
          aria-label="Imagen anterior"
        >
          ‹
        </button>
      )}

      {/* Navigation - Next */}
      {images.length > 1 && (
        <button
          className="absolute top-1/2 right-4 z-40 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white text-white transition-colors hover:bg-white hover:text-black"
          onClick={() =>
            onImageChange(
              currentIndex === images.length - 1 ? 0 : currentIndex + 1
            )
          }
          aria-label="Imagen siguiente"
        >
          ›
        </button>
      )}

      {/* Dots indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              className={`h-2 w-2 rounded-full transition-all ${
                i === currentIndex ? "w-6 bg-white" : "bg-gray-400"
              }`}
              onClick={() => onImageChange(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-pressed={i === currentIndex}
            />
          ))}
        </div>
      )}

      {/* Zoom info */}
      <div className="absolute top-4 left-4 z-40 text-sm text-white">
        {zoom !== 1 && <span>Zoom: {Math.round(zoom * 100)}%</span>}
      </div>

      {/* Instructions text */}
      <div className="absolute bottom-16 left-1/2 z-40 -translate-x-1/2 text-center text-sm text-white opacity-50">
        {zoom === 1 ? (
          <p>Rueda para hacer zoom • Flechas para navegar</p>
        ) : (
          <p>Arrastra para mover • Rueda para ajustar zoom</p>
        )}
      </div>
    </div>
  );
}
