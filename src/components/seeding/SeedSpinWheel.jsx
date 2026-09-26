import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeWheelRotation, getOrdinalLabel, pickSpinIndex } from '../../utils/iplPlayoffs';

const SEGMENT_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
];

const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const SeedSpinWheel = ({
  segments = [],
  disabled = false,
  spinning = false,
  onSpinComplete,
  teamLabel = 'Team',
}) => {
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const landingIndexRef = useRef(0);
  const rotationRef = useRef(0);
  const animatingRef = useRef(false);
  const completedForSpinRef = useRef(false);
  const diskRef = useRef(null);
  const safetyTimerRef = useRef(null);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => () => {
    animatingRef.current = false;
    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const gradient = useMemo(() => {
    if (!segments.length) return '#334155';
    const slice = 360 / segments.length;
    return segments.map((segment, index) => {
      const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
      const start = index * slice;
      const end = (index + 1) * slice;
      return `${color} ${start}deg ${end}deg`;
    }).join(', ');
  }, [segments]);

  const finishSpin = () => {
    if (!animatingRef.current || completedForSpinRef.current) return;
    completedForSpinRef.current = true;
    animatingRef.current = false;
    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    setIsAnimating(false);
    const landed = segments[landingIndexRef.current];
    if (landed && typeof onSpinComplete === 'function') {
      onSpinComplete(landed, landingIndexRef.current);
    }
  };

  const handleSpin = () => {
    if (disabled || animatingRef.current || spinning || segments.length === 0) return;

    const landingIndex = pickSpinIndex(segments.length);
    landingIndexRef.current = landingIndex;
    completedForSpinRef.current = false;
    animatingRef.current = true;
    setIsAnimating(true);

    const reduced = prefersReducedMotion();
    const durationMs = reduced ? 850 : 4400;
    const nextRotation = computeWheelRotation({
      segmentCount: segments.length,
      landingIndex,
      currentRotation: rotationRef.current,
      extraSpins: reduced ? 1 : 5 + Math.floor(Math.random() * 3),
    });

    const disk = diskRef.current;
    if (disk) {
      // Snap without transition, then animate to target (prevents skipped/glitchy spins).
      disk.style.transition = 'none';
      disk.style.transform = `rotate(${rotationRef.current}deg)`;
      void disk.offsetWidth;
      disk.style.transition = reduced
        ? `transform ${durationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
        : `transform ${durationMs}ms cubic-bezier(0.12, 0.72, 0.05, 1)`;
    }

    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
    }
    safetyTimerRef.current = window.setTimeout(finishSpin, durationMs + 120);

    requestAnimationFrame(() => {
      setRotation(nextRotation);
      rotationRef.current = nextRotation;
    });
  };

  const handleTransitionEnd = (event) => {
    if (event.target !== diskRef.current) return;
    if (event.propertyName !== 'transform') return;
    finishSpin();
  };

  const busy = disabled || isAnimating || spinning || segments.length === 0;

  return (
    <div className="seed-spin-wheel">
      <p className="seed-spin-wheel-caption">
        Spinning for <strong>{teamLabel}</strong>
      </p>
      <div className="seed-spin-wheel-stage">
        <div className="seed-spin-wheel-pointer" aria-hidden="true" />
        <div
          ref={diskRef}
          className={`seed-spin-wheel-disk ${isAnimating ? 'is-spinning' : ''}`}
          style={{
            background: `conic-gradient(from -90deg, ${gradient})`,
            transform: `rotate(${rotation}deg)`,
          }}
          onTransitionEnd={handleTransitionEnd}
          role="img"
          aria-label={`Spin wheel with ${segments.length} positions`}
        >
          {segments.map((segment, index) => {
            const slice = 360 / segments.length;
            const angle = -90 + index * slice + slice / 2;
            return (
              <span
                key={`${segment.value}-${index}`}
                className="seed-spin-wheel-label"
                style={{ transform: `rotate(${angle}deg) translateY(-6.1rem)` }}
              >
                {segment.label || getOrdinalLabel(segment.value)}
              </span>
            );
          })}
          <span className="seed-spin-wheel-hub" aria-hidden="true" />
        </div>
      </div>
      <button
        type="button"
        className="seed-spin-wheel-btn"
        onClick={handleSpin}
        disabled={busy}
      >
        {isAnimating ? 'Spinning…' : 'Spin'}
      </button>
    </div>
  );
};

export default SeedSpinWheel;
