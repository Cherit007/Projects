/**
 * Loads a module that needs native code only when it is used, so an app
 * build made before the module was added keeps working and explains what
 * is missing instead of crashing at startup.
 */
export async function loadNative<T>(load: () => Promise<T>, feature: string): Promise<T> {
  try {
    return await load();
  } catch {
    throw new Error(`${feature} need a newer version of the app. Install the latest build and try again.`);
  }
}
