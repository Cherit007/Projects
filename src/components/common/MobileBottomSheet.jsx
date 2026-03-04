import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const MobileBottomSheet = ({
  open = false,
  title = 'Details',
  subtitle = '',
  onClose,
  children,
  maxWidthClassName = 'max-w-4xl',
  sheetClassName = '',
  bodyClassName = '',
}) => {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[260] bg-black/55 app-overlay flex items-end justify-center p-0"
      onClick={onClose}
    >
      <div
        className={`mobile-bottom-sheet-shell w-full ${maxWidthClassName} bg-white rounded-t-3xl shadow-2xl border border-slate-200 app-modal-shell ${sheetClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mobile-bottom-sheet-grab" aria-hidden="true" />
        <div className="px-4 sm:px-5 pb-3 pt-1 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
        <div className={`overflow-y-auto max-h-[calc(85vh-68px)] px-4 sm:px-5 pb-[calc(env(safe-area-inset-bottom,0px)+0.8rem)] pt-3 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileBottomSheet;

