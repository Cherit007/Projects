import React, { useEffect, useId, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { buildTournamentFormatFlow } from '../utils/tournamentFormats';

const FormatFlowGuide = ({
  format,
  numTeams,
  matchesPerPair = '1',
  className = '',
  buttonClassName = '',
  label = 'How this format works',
}) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const flow = useMemo(
    () => buildTournamentFormatFlow({ format, numTeams, matchesPerPair }),
    [format, numTeams, matchesPerPair]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`format-flow-info-btn ${buttonClassName}`.trim()}
        aria-label={`${label}: ${flow.title}`}
        title={`${label} (${flow.exampleLabel})`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Info size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`format-flow-modal-overlay ${className}`.trim()}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="format-flow-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="format-flow-modal-header">
              <div>
                <p className="format-flow-modal-kicker">Format guide</p>
                <h3 id={titleId} className="format-flow-modal-title">{flow.title}</h3>
              </div>
              <button
                type="button"
                className="format-flow-modal-close"
                aria-label="Close format guide"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <p className="format-flow-modal-summary">{flow.summary}</p>
            <p className="format-flow-modal-example">{flow.exampleLabel}</p>

            <div className="format-flow-chart" aria-label={`${flow.title} match flow for ${flow.exampleLabel}`}>
              {flow.stages.map((stage, index) => (
                <React.Fragment key={`${flow.title}-${stage.title}-${index}`}>
                  {index > 0 && (
                    <div className="format-flow-arrow" aria-hidden="true">
                      <span />
                    </div>
                  )}
                  <section className="format-flow-stage">
                    <p className="format-flow-stage-title">{stage.title}</p>
                    <div className="format-flow-match-grid">
                      {(stage.matches || []).map((matchLabel) => (
                        <div key={`${stage.title}-${matchLabel}`} className="format-flow-match-node">
                          {matchLabel}
                        </div>
                      ))}
                    </div>
                    {stage.note && <p className="format-flow-stage-note">{stage.note}</p>}
                  </section>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FormatFlowGuide;
