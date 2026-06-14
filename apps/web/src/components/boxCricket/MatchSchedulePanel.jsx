import React, { useMemo, useState } from 'react';
import {
  findScheduleConflicts,
  formatMatchScheduleLabel,
  normalizeMatchSchedule,
} from '@fixture-maker/domain/fixture/matchSchedule';

const toDateTimeLocalValue = (isoValue) => {
  if (!isoValue) return '';
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
};

const MatchSchedulePanel = ({
  match,
  fixtures = [],
  onSaveSchedule,
}) => {
  const existing = normalizeMatchSchedule(match?.schedule) || {};
  const [groundLabel, setGroundLabel] = useState(existing.groundLabel || '');
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(existing.startAt));
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(existing.endAt));
  const [savedLabel, setSavedLabel] = useState('');

  const draftSchedule = useMemo(() => normalizeMatchSchedule({
    groundId: groundLabel.trim().toLowerCase().replace(/\s+/g, '-'),
    groundLabel: groundLabel.trim(),
    startAt: fromDateTimeLocalValue(startAt),
    endAt: fromDateTimeLocalValue(endAt),
  }), [groundLabel, startAt, endAt]);

  const conflicts = useMemo(
    () => findScheduleConflicts({ ...match, schedule: draftSchedule }, fixtures, { ignoreMatchId: match?.id }),
    [draftSchedule, fixtures, match],
  );

  const handleSave = () => {
    onSaveSchedule?.(match?.id, draftSchedule);
    setSavedLabel('Saved');
    window.setTimeout(() => setSavedLabel(''), 1500);
  };

  return (
    <div className="variant-a-card variant-a-progress-card mt-3">
      <div className="variant-a-progress-head">
        <span className="variant-a-progress-title">Ground &amp; time slot</span>
        {savedLabel && <span className="text-xs font-semibold text-emerald-600">{savedLabel}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <label className="box-cricket-innings-field">
          <span>Ground / court</span>
          <input
            type="text"
            className="variant-a-score-input"
            placeholder="Court A"
            value={groundLabel}
            onChange={(event) => setGroundLabel(event.target.value)}
            aria-label="Ground label"
          />
        </label>
        <label className="box-cricket-innings-field">
          <span>Start</span>
          <input
            type="datetime-local"
            className="variant-a-score-input"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            aria-label="Start time"
          />
        </label>
        <label className="box-cricket-innings-field">
          <span>End (optional)</span>
          <input
            type="datetime-local"
            className="variant-a-score-input"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            aria-label="End time"
          />
        </label>
      </div>
      {conflicts.hasOverlap && (
        <p className="text-xs text-red-600 mt-2">
          Conflict with {conflicts.conflicts.map((entry) => entry.label).join(', ')} on the same ground.
        </p>
      )}
      {match?.schedule && (
        <p className="variant-a-meta-copy mt-2">{formatMatchScheduleLabel(match.schedule)}</p>
      )}
      <button
        type="button"
        className="variant-a-header-action mt-3"
        onClick={handleSave}
        disabled={conflicts.hasOverlap}
      >
        Save schedule
      </button>
    </div>
  );
};

export default MatchSchedulePanel;
