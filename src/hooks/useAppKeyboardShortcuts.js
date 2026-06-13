import { useEffect, useRef } from 'react';

/**
 * App-level keyboard and layout shortcuts that depend on workspace state.
 */
export const useAppKeyboardShortcuts = ({
  showUtilityDrawer,
  setShowUtilityDrawer,
  isMobileViewport,
  step,
}) => {
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (!isMobileViewport && showUtilityDrawer) {
      setShowUtilityDrawer(false);
    }
  }, [isMobileViewport, showUtilityDrawer, setShowUtilityDrawer]);

  useEffect(() => {
    if (!showUtilityDrawer || typeof window === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowUtilityDrawer(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showUtilityDrawer, setShowUtilityDrawer]);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    if (showUtilityDrawer) {
      setShowUtilityDrawer(false);
    }
  }, [step, showUtilityDrawer, setShowUtilityDrawer]);
};
