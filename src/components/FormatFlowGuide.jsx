import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { buildTournamentFormatFlow } from '../utils/tournamentFormats';

const FormatFlowGuide = ({
  format,
  numTeams,
  matchesPerPair = '1',
  className = '',
  buttonClassName = '',
  label = 'How this format works',
  showText = false,
}) => {
  const [open, setOpen] = useState(false);
  const [includeOddPlayer, setIncludeOddPlayer] = useState(false);
  const titleId = useId();
  const oddToggleId = useId();
  const flow = useMemo(
    () => buildTournamentFormatFlow({
      format,
      numTeams,
      matchesPerPair,
      includeOddPlayer,
    }),
    [format, numTeams, matchesPerPair, includeOddPlayer]
  );

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setIncludeOddPlayer(false);
  }, [open, format]);

  const modal = open ? createPortal(
    (
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
            <div className="format-flow-modal-heading">
              <p className="format-flow-modal-kicker">Format guide</p>
              <h3 id={titleId} className="format-flow-modal-title">{flow.title}</h3>
            </div>
            <button
              type="button"
              className="format-flow-modal-close"
              aria-label="Close format guide"
              onClick={() => setOpen(false)}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="format-flow-modal-body">
            <p className="format-flow-modal-summary">{flow.summary}</p>
            <p className="format-flow-modal-example">{flow.exampleLabel}</p>

            <label className="format-flow-odd-toggle" htmlFor={oddToggleId}>
              <input
                id={oddToggleId}
                type="checkbox"
                checked={includeOddPlayer}
                onChange={(event) => setIncludeOddPlayer(event.target.checked)}
              />
              <span>
                Include odd player (Z)
                <em>Show rotation + sit-out flow in this guide</em>
              </span>
            </label>

            <div
              className="format-flow-chart"
              aria-label={`${flow.title} match flow for ${flow.exampleLabel}`}
            >
              {flow.stages.map((stage, index) => (
                <React.Fragment key={`${flow.title}-${stage.title}-${index}-${includeOddPlayer ? 'odd' : 'base'}`}>
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
      </div>
    ),
    document.body
  ) : null;

  return (
    <>
      <button
        type="button"
        className={`format-flow-info-btn ${showText ? 'is-text' : ''} ${buttonClassName}`.trim()}
        aria-label={showText ? `How selected format works: ${flow.title}` : `${label}: ${flow.title}`}
        title={`${label} (${flow.exampleLabel})`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Info size={showText ? 15 : 14} aria-hidden="true" />
        {showText && <span>How it works</span>}
      </button>
      {modal}
    </>
  );
};

export default FormatFlowGuide;
