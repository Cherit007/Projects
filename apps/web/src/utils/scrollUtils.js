export const scrollMobileShellToTop = (scrollRef) => {
  const resetTargets = () => {
    if (scrollRef?.current) {
      scrollRef.current.scrollTop = 0;
      if (typeof scrollRef.current.scrollTo === 'function') {
        scrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
      return;
    }

    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  resetTargets();
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      resetTargets();
      window.requestAnimationFrame(resetTargets);
    });
  }
};

export const scrollElementToTop = (element) => {
  if (!element) return;
  element.scrollTop = 0;
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
};
