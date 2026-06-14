const supportsVibration = () => (
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
);

export const triggerHaptic = (pattern) => {
  if (!supportsVibration()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
};

export const hapticTap = () => triggerHaptic(12);
export const hapticSubmit = () => triggerHaptic([12, 24, 16]);
export const hapticSuccess = () => triggerHaptic(16);
export const hapticError = () => triggerHaptic([26, 30, 26]);
