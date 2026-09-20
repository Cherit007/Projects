import "@testing-library/jest-dom";
import { beforeEach } from "vitest";

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Hash routing persists on window across tests; clear it so suites don't leak routes.
beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.location.hash = '';
  }
});
