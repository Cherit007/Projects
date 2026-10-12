import type { CloudBackend } from './backend';
import { createAppwriteBackend } from './appwrite/appwriteBackend';
import { isAppwriteConfigured } from './appwrite/config';

let backend: CloudBackend | null | undefined;

/**
 * The cloud backend for this build, or null when none is configured (the app
 * then runs fully offline). To move to another backend, implement
 * `CloudBackend` in its own folder and return it here.
 */
export function cloudBackend(): CloudBackend | null {
  if (backend === undefined) {
    backend = isAppwriteConfigured ? createAppwriteBackend() : null;
  }
  return backend;
}
