import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

const TONE_STYLES = {
  danger: {
    icon: 'text-rose-600',
    confirm: 'modal-btn-danger',
  },
  primary: {
    icon: 'text-blue-600',
    confirm: 'modal-btn-primary',
  },
};

const ConfirmActionModal = ({
  open = false,
  title = 'Confirm Action',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open || busy) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const toneConfig = TONE_STYLES[tone] || TONE_STYLES.danger;

  return (
    <div className="fixed inset-0 z-[320] bg-black/55 flex items-center justify-center p-4 app-overlay app-overlay-center">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 app-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 ${toneConfig.icon}`}>
              <AlertTriangle size={20} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600 mt-1">{message}</p>
            </div>
          </div>
        </div>
        <div className="p-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="modal-btn modal-btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`modal-btn ${toneConfig.confirm}`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
