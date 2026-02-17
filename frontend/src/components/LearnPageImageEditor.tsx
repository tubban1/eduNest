'use client';

import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type AttachedImage = { file: File; dataUrl: string; base64: string; mimeType: string };

type Props = {
  image: AttachedImage;
  onApply: (updated: AttachedImage) => void;
  onClose: () => void;
};

function getRelativeCoordinates(
  containerRef: React.RefObject<HTMLDivElement | null>,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  if (!containerRef.current) return null;
  const rect = containerRef.current.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function detectDragType(
  x: number,
  y: number,
  cropArea: { x: number; y: number; width: number; height: number }
): 'move' | 'nw' | 'ne' | 'sw' | 'se' | null {
  const handleSize = 20;
  const { x: cx, y: cy, width, height } = cropArea;
  if (Math.abs(x - cx) < handleSize && Math.abs(y - cy) < handleSize) return 'nw';
  if (Math.abs(x - (cx + width)) < handleSize && Math.abs(y - cy) < handleSize) return 'ne';
  if (Math.abs(x - cx) < handleSize && Math.abs(y - (cy + height)) < handleSize) return 'sw';
  if (Math.abs(x - (cx + width)) < handleSize && Math.abs(y - (cy + height)) < handleSize) return 'se';
  if (x >= cx && x <= cx + width && y >= cy && y <= cy + height) return 'move';
  return null;
}

export default function LearnPageImageEditor({ image, onApply, onClose }: Props) {
  const { t } = useTranslation(['content', 'common']);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageFlipH, setImageFlipH] = useState(false);
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragType, setDragType] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const initialCropAreaRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleRotate = useCallback((degrees: number) => {
    setImageRotation((prev) => (prev + degrees) % 360);
    setCropArea(null);
  }, []);

  const handleFlip = useCallback(() => {
    setImageFlipH((prev) => !prev);
    setCropArea(null);
  }, []);

  const handleStartCrop = useCallback(() => {
    setCropMode(true);
    if (imageRef.current && imageContainerRef.current) {
      const img = imageRef.current;
      const container = imageContainerRef.current;
      const imgRect = img.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const imgDisplayWidth = img.clientWidth || imgRect.width;
      const imgDisplayHeight = img.clientHeight || imgRect.height;
      const imgCenterX = imgRect.left + imgRect.width / 2;
      const imgCenterY = imgRect.top + imgRect.height / 2;
      const imgDisplayX = imgCenterX - containerRect.left - imgDisplayWidth / 2;
      const imgDisplayY = imgCenterY - containerRect.top - imgDisplayHeight / 2;
      const cropWidth = imgDisplayWidth * 0.8;
      const cropHeight = imgDisplayHeight * 0.8;
      setCropArea({
        x: imgDisplayX + (imgDisplayWidth - cropWidth) / 2,
        y: imgDisplayY + (imgDisplayHeight - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      });
    }
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCropMode(false);
    setCropArea(null);
    setIsDragging(false);
    setDragStart(null);
    setDragType(null);
  }, []);

  const updateCropArea = useCallback(
    (
      currentX: number,
      currentY: number,
      startCoords: { x: number; y: number },
      dragType: string,
      initialCropArea: { x: number; y: number; width: number; height: number }
    ) => {
      if (!imageRef.current || !imageContainerRef.current) return;
      const img = imageRef.current;
      const container = imageContainerRef.current;
      const imgRect = img.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const imageAspectRatio = naturalWidth / naturalHeight;
      const elementWidth = imgRect.width;
      const elementHeight = imgRect.height;
      const containerAspectRatio = elementWidth / elementHeight;
      let imgDisplayWidth: number, imgDisplayHeight: number;
      if (imageAspectRatio > containerAspectRatio) {
        imgDisplayWidth = elementWidth;
        imgDisplayHeight = elementWidth / imageAspectRatio;
      } else {
        imgDisplayWidth = elementHeight * imageAspectRatio;
        imgDisplayHeight = elementHeight;
      }
      let imgDisplayX: number, imgDisplayY: number;
      if (imageRotation === 0) {
        const contentOffsetX = (elementWidth - imgDisplayWidth) / 2;
        const contentOffsetY = (elementHeight - imgDisplayHeight) / 2;
        imgDisplayX = imgRect.left - containerRect.left + contentOffsetX;
        imgDisplayY = imgRect.top - containerRect.top + contentOffsetY;
      } else {
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgCenterY = imgRect.top + imgRect.height / 2;
        imgDisplayX = imgCenterX - containerRect.left - imgDisplayWidth / 2;
        imgDisplayY = imgCenterY - containerRect.top - imgDisplayHeight / 2;
      }
      const minX = imgDisplayX;
      const maxX = imgDisplayX + imgDisplayWidth;
      const minY = imgDisplayY;
      const maxY = imgDisplayY + imgDisplayHeight;
      const deltaX = currentX - startCoords.x;
      const deltaY = currentY - startCoords.y;
      const minSize = 50;
      let newCropArea = { ...initialCropArea };

      switch (dragType) {
        case 'move':
          newCropArea.x = Math.max(minX, Math.min(maxX - newCropArea.width, initialCropArea.x + deltaX));
          newCropArea.y = Math.max(minY, Math.min(maxY - newCropArea.height, initialCropArea.y + deltaY));
          break;
        case 'nw':
          newCropArea.x = Math.max(minX, Math.min(initialCropArea.x + initialCropArea.width - minSize, initialCropArea.x + deltaX));
          newCropArea.y = Math.max(minY, Math.min(initialCropArea.y + initialCropArea.height - minSize, initialCropArea.y + deltaY));
          newCropArea.width = initialCropArea.x + initialCropArea.width - newCropArea.x;
          newCropArea.height = initialCropArea.y + initialCropArea.height - newCropArea.y;
          if (newCropArea.width < minSize) {
            newCropArea.width = minSize;
            newCropArea.x = initialCropArea.x + initialCropArea.width - minSize;
          }
          if (newCropArea.height < minSize) {
            newCropArea.height = minSize;
            newCropArea.y = initialCropArea.y + initialCropArea.height - minSize;
          }
          break;
        case 'ne':
          newCropArea.y = Math.max(minY, Math.min(initialCropArea.y + initialCropArea.height - minSize, initialCropArea.y + deltaY));
          newCropArea.width = Math.max(minSize, Math.min(maxX - initialCropArea.x, initialCropArea.width + deltaX));
          newCropArea.height = initialCropArea.y + initialCropArea.height - newCropArea.y;
          if (newCropArea.height < minSize) {
            newCropArea.height = minSize;
            newCropArea.y = initialCropArea.y + initialCropArea.height - minSize;
          }
          break;
        case 'sw':
          newCropArea.x = Math.max(minX, Math.min(initialCropArea.x + initialCropArea.width - minSize, initialCropArea.x + deltaX));
          newCropArea.width = initialCropArea.x + initialCropArea.width - newCropArea.x;
          newCropArea.height = Math.max(minSize, Math.min(maxY - initialCropArea.y, initialCropArea.height + deltaY));
          if (newCropArea.width < minSize) {
            newCropArea.width = minSize;
            newCropArea.x = initialCropArea.x + initialCropArea.width - minSize;
          }
          break;
        case 'se':
          newCropArea.width = Math.max(minSize, Math.min(maxX - initialCropArea.x, initialCropArea.width + deltaX));
          newCropArea.height = Math.max(minSize, Math.min(maxY - initialCropArea.y, initialCropArea.height + deltaY));
          break;
      }
      if (newCropArea.x < minX) {
        newCropArea.width -= minX - newCropArea.x;
        newCropArea.x = minX;
      }
      if (newCropArea.y < minY) {
        newCropArea.height -= minY - newCropArea.y;
        newCropArea.y = minY;
      }
      if (newCropArea.x + newCropArea.width > maxX) newCropArea.width = maxX - newCropArea.x;
      if (newCropArea.y + newCropArea.height > maxY) newCropArea.height = maxY - newCropArea.y;
      setCropArea(newCropArea);
    },
    [imageRotation]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    if (!cropMode || !cropArea) return;
    e.preventDefault();
    const coords = getRelativeCoordinates(imageContainerRef, e.clientX, e.clientY);
    if (!coords) return;
    const detected = detectDragType(coords.x, coords.y, cropArea);
    if (!detected) return;
    initialCropAreaRef.current = { ...cropArea };
    setDragType(detected);
    setDragStart(coords);
    setIsDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!cropMode || !isDragging || !dragStart || !dragType || !initialCropAreaRef.current) return;
    e.preventDefault();
    const coords = getRelativeCoordinates(imageContainerRef, e.clientX, e.clientY);
    if (!coords) return;
    updateCropArea(coords.x, coords.y, dragStart, dragType, initialCropAreaRef.current);
  };

  const onMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
    initialCropAreaRef.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!cropMode || !cropArea) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const coords = getRelativeCoordinates(imageContainerRef, touch.clientX, touch.clientY);
    if (!coords) return;
    const detected = detectDragType(coords.x, coords.y, cropArea);
    if (!detected) return;
    initialCropAreaRef.current = { ...cropArea };
    setDragType(detected);
    setDragStart(coords);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!cropMode || !isDragging || !dragStart || !dragType || !initialCropAreaRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const coords = getRelativeCoordinates(imageContainerRef, touch.clientX, touch.clientY);
    if (!coords) return;
    updateCropArea(coords.x, coords.y, dragStart, dragType, initialCropAreaRef.current);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    setDragType(null);
    initialCropAreaRef.current = null;
  };

  const handleApplyEdit = useCallback(() => {
    if (!imageRef.current || !imageContainerRef.current) return;
    const img = imageRef.current;
    const container = imageContainerRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const elementWidth = imgRect.width;
    const elementHeight = imgRect.height;
    const imageAspectRatio = naturalWidth / naturalHeight;
    const containerAspectRatio = elementWidth / elementHeight;
    let displayWidth: number, displayHeight: number;
    if (imageAspectRatio > containerAspectRatio) {
      displayWidth = elementWidth;
      displayHeight = elementWidth / imageAspectRatio;
    } else {
      displayWidth = elementHeight * imageAspectRatio;
      displayHeight = elementHeight;
    }
    const scaleX = naturalWidth / displayWidth;
    const scaleY = naturalHeight / displayHeight;

    let sourceX = 0,
      sourceY = 0,
      sourceWidth = naturalWidth,
      sourceHeight = naturalHeight;

    if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
      let imgDisplayX: number, imgDisplayY: number;
      if (imageRotation === 0) {
        const contentOffsetX = (elementWidth - displayWidth) / 2;
        const contentOffsetY = (elementHeight - displayHeight) / 2;
        imgDisplayX = imgRect.left - containerRect.left + contentOffsetX;
        imgDisplayY = imgRect.top - containerRect.top + contentOffsetY;
      } else {
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgCenterY = imgRect.top + imgRect.height / 2;
        imgDisplayX = imgCenterX - containerRect.left - displayWidth / 2;
        imgDisplayY = imgCenterY - containerRect.top - displayHeight / 2;
      }
      const cropXRel = cropArea.x - imgDisplayX;
      const cropYRel = cropArea.y - imgDisplayY;
      const clampedCropX = Math.max(0, Math.min(cropXRel, displayWidth));
      const clampedCropY = Math.max(0, Math.min(cropYRel, displayHeight));
      const clampedCropWidth = Math.max(0, Math.min(cropArea.width, displayWidth - clampedCropX));
      const clampedCropHeight = Math.max(0, Math.min(cropArea.height, displayHeight - clampedCropY));
      sourceWidth = clampedCropWidth * scaleX;
      sourceHeight = clampedCropHeight * scaleY;
      if (imageFlipH && imageRotation === 0) {
        sourceX = (displayWidth - clampedCropX - clampedCropWidth) * scaleX;
        sourceY = clampedCropY * scaleY;
      } else {
        sourceX = clampedCropX * scaleX;
        sourceY = clampedCropY * scaleY;
      }
      sourceX = Math.max(0, Math.min(sourceX, naturalWidth));
      sourceY = Math.max(0, Math.min(sourceY, naturalHeight));
      sourceWidth = Math.max(0, Math.min(sourceWidth, naturalWidth - sourceX));
      sourceHeight = Math.max(0, Math.min(sourceHeight, naturalHeight - sourceY));
    }

    let workingCanvas = canvas;
    let workingCtx = ctx;

    if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
      workingCanvas.width = sourceWidth;
      workingCanvas.height = sourceHeight;
      workingCtx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    } else {
      workingCanvas.width = img.naturalWidth;
      workingCanvas.height = img.naturalHeight;
      workingCtx.drawImage(img, 0, 0);
    }

    if (imageFlipH) {
      const flipCanvas = document.createElement('canvas');
      flipCanvas.width = workingCanvas.width;
      flipCanvas.height = workingCanvas.height;
      const flipCtx = flipCanvas.getContext('2d');
      if (!flipCtx) {
        onClose();
        return;
      }
      flipCtx.translate(flipCanvas.width, 0);
      flipCtx.scale(-1, 1);
      flipCtx.drawImage(workingCanvas, 0, 0);
      workingCanvas = flipCanvas;
    }

    if (imageRotation !== 0) {
      const rad = (imageRotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const newWidth = workingCanvas.width * cos + workingCanvas.height * sin;
      const newHeight = workingCanvas.width * sin + workingCanvas.height * cos;
      const rotatedCanvas = document.createElement('canvas');
      const rotatedCtx = rotatedCanvas.getContext('2d');
      if (!rotatedCtx) {
        onClose();
        return;
      }
      rotatedCanvas.width = newWidth;
      rotatedCanvas.height = newHeight;
      rotatedCtx.fillStyle = '#FFFFFF';
      rotatedCtx.fillRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);
      rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rotatedCtx.rotate((imageRotation * Math.PI) / 180);
      rotatedCtx.translate(-workingCanvas.width / 2, -workingCanvas.height / 2);
      rotatedCtx.drawImage(workingCanvas, 0, 0);
      workingCanvas = rotatedCanvas;
    }

    let outputMimeType = image.mimeType;
    if (image.mimeType === 'image/png' || image.mimeType === 'image/gif') outputMimeType = 'image/jpeg';
    const dataUrl = workingCanvas.toDataURL(outputMimeType, 0.8);
    const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      onApply({
        file: image.file,
        dataUrl,
        base64: base64Match[2],
        mimeType: base64Match[1],
      });
    }
    onClose();
  }, [image, cropArea, imageRotation, imageFlipH, onApply, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl p-4 m-4 border border-slate-200 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('content:editImage', { defaultValue: '编辑图片' })}
          </h3>
          <button type="button" className="text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          ref={imageContainerRef}
          className="relative bg-muted/30 rounded-lg overflow-hidden mb-4 cursor-crosshair touch-none"
          style={{ minHeight: '300px', userSelect: 'none', WebkitUserSelect: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <img
            ref={imageRef}
            src={image.dataUrl}
            alt="Edit"
            className="w-full h-auto max-h-96 object-contain block select-none pointer-events-none"
            style={{
              transform: `scaleX(${imageFlipH ? -1 : 1}) rotate(${imageRotation}deg)`,
              transition: 'transform 0.3s ease',
            }}
            draggable={false}
          />
          {cropMode && cropArea && cropArea.width > 0 && cropArea.height > 0 && (
            <>
              <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: `${cropArea.y}px` }} />
              <div
                className="absolute bg-black/50"
                style={{ bottom: 0, left: 0, right: 0, top: `${cropArea.y + cropArea.height}px` }}
              />
              <div
                className="absolute bg-black/50"
                style={{ top: `${cropArea.y}px`, left: 0, width: `${cropArea.x}px`, height: `${cropArea.height}px` }}
              />
              <div
                className="absolute bg-black/50"
                style={{
                  top: `${cropArea.y}px`,
                  right: 0,
                  left: `${cropArea.x + cropArea.width}px`,
                  height: `${cropArea.height}px`,
                }}
              />
              <div
                className="absolute border-2 border-primary"
                style={{
                  left: `${cropArea.x}px`,
                  top: `${cropArea.y}px`,
                  width: `${cropArea.width}px`,
                  height: `${cropArea.height}px`,
                  cursor: isDragging && dragType === 'move' ? 'grabbing' : 'grab',
                }}
              />
              {[
                { left: cropArea.x - 10, top: cropArea.y - 10, cursor: 'nwse-resize' },
                { left: cropArea.x + cropArea.width - 10, top: cropArea.y - 10, cursor: 'nesw-resize' },
                { left: cropArea.x - 10, top: cropArea.y + cropArea.height - 10, cursor: 'nesw-resize' },
                { left: cropArea.x + cropArea.width - 10, top: cropArea.y + cropArea.height - 10, cursor: 'nwse-resize' },
              ].map((s, i) => (
                <div
                  key={i}
                  className="absolute bg-primary border-2 border-white rounded-full"
                  style={{
                    left: `${s.left}px`,
                    top: `${s.top}px`,
                    width: 20,
                    height: 20,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    cursor: s.cursor,
                  }}
                />
              ))}
            </>
          )}
        </div>

        <div className="flex gap-2 justify-center mb-4 flex-wrap">
          <button
            type="button"
            onClick={handleFlip}
            className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
            disabled={cropMode}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22V2M2 12h20M4 6l4 6-4 6M20 6l-4 6 4 6" />
            </svg>
            {t('content:flip', { defaultValue: '翻转' })}
          </button>
          <button
            type="button"
            onClick={() => handleRotate(90)}
            className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
            disabled={cropMode}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('content:rotateRight', { defaultValue: '向右旋转 90°' })}
          </button>
          {!cropMode ? (
            <button
              type="button"
              onClick={handleStartCrop}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              {t('content:startCrop', { defaultValue: '开始裁剪' })}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelCrop}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('content:cancelCrop', { defaultValue: '取消裁剪' })}
            </button>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition"
          >
            {t('common:cancel', { defaultValue: '取消' })}
          </button>
          <button type="button" onClick={handleApplyEdit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
            {t('content:apply', { defaultValue: '应用' })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
