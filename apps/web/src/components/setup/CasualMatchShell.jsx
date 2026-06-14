import React from 'react';
import { ChevronLeft } from 'lucide-react';

const CasualMatchShell = ({
  layout = 'modal',
  title,
  subtitle,
  icon: Icon = null,
  onClose,
  backLabel = 'Back',
  headerTone = 'green',
  children,
  className = '',
}) => {
  const toneClass = headerTone === 'emerald'
    ? 'from-emerald-800 via-teal-700 to-cyan-800'
    : 'from-green-700 via-teal-600 to-emerald-700';

  const header = (
    <div className={`casual-match-header bg-gradient-to-br ${toneClass} px-5 py-4 sm:px-6 sm:py-5 shrink-0 relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-20 pointer-events-none casual-match-header-pattern" aria-hidden />
      <div className="relative z-[1] flex flex-col gap-3">
        {typeof onClose === 'function' && (
          <button
            type="button"
            onClick={onClose}
            className="casual-match-back inline-flex items-center gap-1 text-sm font-semibold text-white/90 hover:text-white transition-colors w-fit"
          >
            <ChevronLeft size={18} aria-hidden />
            {backLabel}
          </button>
        )}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
            {Icon ? <Icon size={22} className="opacity-90" /> : null}
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm text-white/80 mt-1 max-w-xl">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (layout === 'inline') {
    return (
      <section className={`start-match-casual-panel casual-match-inline ${className}`.trim()}>
        {header}
        <div className="casual-match-body p-4 sm:p-6">{children}</div>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
      <div className={`rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col app-modal-shell casual-modal-shell ${className}`.trim()}>
        {header}
        <div className="casual-match-body p-6 overflow-y-auto min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
};

export default CasualMatchShell;
