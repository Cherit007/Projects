import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Save, X } from 'lucide-react';
import { calculateDrawParams, clamp } from '../../utils/photoCrop';

const PREVIEW_SIZE = 240;
const OUTPUT_SIZE = 320;

const PlayerPhotoEditorModal = ({ playerName, onSave, onClose }) => {
  const [fileUrl, setFileUrl] = useState('');
  const [imageEl, setImageEl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fileUrl) {
      setImageEl(null);
      return;
    }

    const img = new Image();
    img.onload = () => setImageEl(img);
    img.onerror = () => setImageEl(null);
    img.src = fileUrl;
  }, [fileUrl]);

  useEffect(() => {
    return () => {
      if (fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  const bounds = useMemo(() => {
    if (!imageEl) {
      return { maxOffsetX: 0, maxOffsetY: 0 };
    }

    return calculateDrawParams({
      imgWidth: imageEl.width,
      imgHeight: imageEl.height,
      canvasSize: PREVIEW_SIZE,
      zoom,
      offsetX,
      offsetY,
    });
  }, [imageEl, zoom, offsetX, offsetY]);

  useEffect(() => {
    if (!imageEl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const draw = calculateDrawParams({
      imgWidth: imageEl.width,
      imgHeight: imageEl.height,
      canvasSize: PREVIEW_SIZE,
      zoom,
      offsetX,
      offsetY,
    });

    if (draw.boundedOffsetX !== offsetX) {
      setOffsetX(draw.boundedOffsetX);
      return;
    }

    if (draw.boundedOffsetY !== offsetY) {
      setOffsetY(draw.boundedOffsetY);
      return;
    }

    context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    context.drawImage(imageEl, draw.x, draw.y, draw.drawWidth, draw.drawHeight);
  }, [imageEl, zoom, offsetX, offsetY]);

  const handleSelectFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (fileUrl.startsWith('blob:')) {
      URL.revokeObjectURL(fileUrl);
    }

    const localUrl = URL.createObjectURL(file);
    setFileUrl(localUrl);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const exportImage = () => {
    if (!imageEl) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const context = canvas.getContext('2d');
    if (!context) return;

    const draw = calculateDrawParams({
      imgWidth: imageEl.width,
      imgHeight: imageEl.height,
      canvasSize: OUTPUT_SIZE,
      zoom,
      offsetX: (offsetX / PREVIEW_SIZE) * OUTPUT_SIZE,
      offsetY: (offsetY / PREVIEW_SIZE) * OUTPUT_SIZE,
    });

    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.drawImage(imageEl, draw.x, draw.y, draw.drawWidth, draw.drawHeight);

    const dataUrl = canvas.toDataURL('image/png', 0.92);
    onSave?.(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-4 flex items-center justify-between">
          <h4 className="text-white font-semibold text-lg">Edit Photo: {playerName}</h4>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm font-semibold text-gray-600 cursor-pointer hover:border-indigo-400 hover:text-indigo-600">
            <ImagePlus size={16} /> Upload from device
            <input type="file" accept="image/*" className="hidden" onChange={handleSelectFile} />
          </label>

          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              className="rounded-xl border border-gray-300 bg-slate-50"
            />
          </div>

          {imageEl ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Zoom</p>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(parseFloat(event.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Horizontal</p>
                <input
                  type="range"
                  min={-Math.round(bounds.maxOffsetX)}
                  max={Math.round(bounds.maxOffsetX)}
                  value={offsetX}
                  onChange={(event) => setOffsetX(clamp(parseInt(event.target.value, 10) || 0, -bounds.maxOffsetX, bounds.maxOffsetX))}
                  className="w-full"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Vertical</p>
                <input
                  type="range"
                  min={-Math.round(bounds.maxOffsetY)}
                  max={Math.round(bounds.maxOffsetY)}
                  value={offsetY}
                  onChange={(event) => setOffsetY(clamp(parseInt(event.target.value, 10) || 0, -bounds.maxOffsetY, bounds.maxOffsetY))}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center">Upload an image to crop and fit.</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={exportImage}
              disabled={!imageEl}
              className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={16} /> Save Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPhotoEditorModal;
