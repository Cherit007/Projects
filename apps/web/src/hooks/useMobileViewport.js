import { useEffect, useState } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

const readMobileViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
};

export const useMobileViewport = () => {
  const [isMobileViewport, setIsMobileViewport] = useState(readMobileViewport);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateViewport = () => {
      setIsMobileViewport(media.matches);
    };

    updateViewport();

    if (media.addEventListener) {
      media.addEventListener('change', updateViewport);
    } else {
      media.addListener(updateViewport);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', updateViewport);
      } else {
        media.removeListener(updateViewport);
      }
    };
  }, []);

  return isMobileViewport;
};
