import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeBallOrbit,
  computeWheelRotation,
  getOrdinalLabel,
  pickSpinIndex,
} from '../../utils/iplPlayoffs';

const SEGMENT_COLORS = [
  '#1d4ed8',
  '#b91c1c',
  '#0f766e',
  '#a16207',
  '#6d28d9',
  '#0369a1',
  '#c2410c',
  '#334155',
];

const BALL_OUTER_RADIUS_REM = 7.05;
const BALL_POCKET_RADIUS_REM = 6.15;

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
  const [ballAngle, setBallAngle] = useState(0);
  const [ballRadius, setBallRadius] = useState(BALL_POCKET_RADIUS_REM);
  const [wheelTransition, setWheelTransition] = useState('none');
  const [ballTransition, setBallTransition] = useState('none');
  const [isAnimating, setIsAnimating] = useState(false);
  const [phase, setPhase] = useState('idle');
  const landingIndexRef = useRef(0);
  const rotationRef = useRef(0);
  const ballAngleRef = useRef(0);
  const animatingRef = useRef(false);
  const completedForSpinRef = useRef(false);
  const diskRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const dropTimerRef = useRef(null);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    ballAngleRef.current = ballAngle;
  }, [ballAngle]);

  useEffect(() => () => {
    animatingRef.current = false;
    if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
    if (dropTimerRef.current) window.clearTimeout(dropTimerRef.current);
  }, []);

  const gradient = useMemo(() => {
    if (!segments.length) return '#1e293b';
    const slice = 360 / segments.length;
    return segments.map((_, index) => {
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
    if (dropTimerRef.current) {
      window.clearTimeout(dropTimerRef.current);
      dropTimerRef.current = null;
    }
    setWheelTransition('none');
    setBallTransition('none');
    setBallRadius(BALL_POCKET_RADIUS_REM);
    setPhase('settled');
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
    setPhase('orbit');

    const reduced = prefersReducedMotion();
    const durationMs = reduced ? 900 : 5600;
    const dropAtMs = reduced ? 520 : Math.floor(durationMs * 0.7);
    const easing = reduced
      ? 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      : 'cubic-bezier(0.08, 0.72, 0.04, 1)';

    const nextRotation = computeWheelRotation({
      segmentCount: segments.length,
      landingIndex,
      currentRotation: rotationRef.current,
      extraSpins: reduced ? 1 : 5 + Math.floor(Math.random() * 3),
    });
    const nextBallAngle = computeBallOrbit({
      currentAngle: ballAngleRef.current,
      extraSpins: reduced ? 2 : 7 + Math.floor(Math.random() * 3),
    });

    // Snap to current pose on the outer track, then animate.
    setWheelTransition('none');
    setBallTransition('none');
    setBallRadius(BALL_OUTER_RADIUS_REM);
    setRotation(rotationRef.current);
    setBallAngle(ballAngleRef.current);

    if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
    if (dropTimerRef.current) window.clearTimeout(dropTimerRef.current);
    safetyTimerRef.current = window.setTimeout(finishSpin, durationMs + 180);
    dropTimerRef.current = window.setTimeout(() => {
      setPhase('drop');
      const remaining = Math.max(320, durationMs - dropAtMs);
      setBallTransition(`transform ${remaining}ms cubic-bezier(0.22, 0.6, 0.18, 1)`);
      setBallRadius(BALL_POCKET_RADIUS_REM);
    }, dropAtMs);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWheelTransition(`transform ${durationMs}ms ${easing}`);
        setBallTransition(`transform ${durationMs}ms ${easing}`);
        setRotation(nextRotation);
        rotationRef.current = nextRotation;
        setBallAngle(nextBallAngle);
        ballAngleRef.current = nextBallAngle;
      });
    });
  };

  const handleTransitionEnd = (event) => {
    if (event.target !== diskRef.current) return;
    if (event.propertyName !== 'transform') return;
    finishSpin();
  };

  const busy = disabled || isAnimating || spinning || segments.length === 0;
  const slice = segments.length > 0 ? 360 / segments.length : 90;

  return (
    <div className="seed-spin-wheel">
      <p className="seed-spin-wheel-caption">
        Spinning for <strong>{teamLabel}</strong>
      </p>
      <div className={`seed-spin-wheel-stage ${isAnimating ? 'is-spinning' : ''} phase-${phase}`}>
        <div className="seed-spin-wheel-shadow" aria-hidden="true" />
        <div className="seed-spin-wheel-base" aria-hidden="true" />
        <div className="seed-spin-wheel-rim" aria-hidden="true" />
        <div className="seed-spin-wheel-track" aria-hidden="true" />
        <div className="seed-spin-wheel-marker" aria-hidden="true">
          <span className="seed-spin-wheel-marker-stem" />
          <span className="seed-spin-wheel-marker-tip" />
        </div>

        <div
          ref={diskRef}
          className={`seed-spin-wheel-disk ${isAnimating ? 'is-spinning' : ''}`}
          style={{
            background: `conic-gradient(from -90deg, ${gradient})`,
            transform: `rotate(${rotation}deg)`,
            transition: wheelTransition,
          }}
          onTransitionEnd={handleTransitionEnd}
          role="img"
          aria-label={`Spin wheel with ${segments.length} positions`}
        >
          <div className="seed-spin-wheel-pocket-ring" aria-hidden="true" />
          {segments.map((_, index) => (
            <span
              key={`fret-${index}`}
              className="seed-spin-wheel-fret"
              style={{ transform: `rotate(${-90 + index * slice}deg) translateY(-50%)` }}
              aria-hidden="true"
            />
          ))}
          {segments.map((segment, index) => {
            const angle = -90 + index * slice + slice / 2;
            return (
              <span
                key={`${segment.value}-${index}`}
                className="seed-spin-wheel-label"
                style={{ transform: `rotate(${angle}deg) translateY(-4.5rem)` }}
              >
                <span className="seed-spin-wheel-bucket">
                  {segment.label || getOrdinalLabel(segment.value)}
                </span>
              </span>
            );
          })}
          <span className="seed-spin-wheel-hub" aria-hidden="true">
            <span className="seed-spin-wheel-hub-ring" />
            <span className="seed-spin-wheel-hub-core" />
          </span>
        </div>

        <div
          className={`seed-spin-wheel-ball ${isAnimating ? 'is-rolling' : ''} ${phase === 'drop' || phase === 'settled' ? 'in-pocket' : ''}`}
          style={{
            transform: `rotate(${ballAngle}deg) translateY(-${ballRadius}rem)`,
            transition: ballTransition,
          }}
          aria-hidden="true"
        >
          <span className="seed-spin-wheel-ball-body">
            <span className="seed-spin-wheel-ball-shine" />
          </span>
        </div>
      </div>
      <p className="seed-spin-wheel-status" aria-live="polite">
        {isAnimating
          ? (phase === 'drop' ? 'Ball dropping into a pocket…' : 'Ball racing the track…')
          : phase === 'settled'
            ? 'Ball settled in a pocket'
            : 'Tap Spin — ball lands in a pocket'}
      </p>
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
