import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import {
  flushQueuedLocalStorageWrites,
  resetLocalStorageWriteQueue,
} from "../services/localStorageWriteService";

afterEach(() => {
  cleanup();
  flushQueuedLocalStorageWrites();
  resetLocalStorageWriteQueue();
  if (typeof window !== "undefined") {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = "#/setup";
  }
});

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
