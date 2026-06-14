import "@testing-library/jest-dom";
import { act, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import {
  flushQueuedLocalStorageWrites,
  resetLocalStorageWriteQueue,
} from "../services/localStorageWriteService";
import { resetQueryCachePersistenceForTests } from "../queryPersistence";

afterEach(async () => {
  cleanup();
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  flushQueuedLocalStorageWrites();
  resetLocalStorageWriteQueue();
  resetQueryCachePersistenceForTests();
  if (typeof window !== "undefined") {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = "#/sports";
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
