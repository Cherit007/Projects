/**
 * Badminton PWA registers a service worker at /Projects/sw.js whose scope
 * covers ExamPulse (/Projects/exam-tracker/). That SW was cloning Response
 * bodies after the page had already started reading them.
 * Unregister it here and drop its caches so ExamPulse loads cleanly.
 */
export async function releaseParentServiceWorker() {
  if (!import.meta.env.BASE_URL.includes('/Projects/exam-tracker')) return
  if (!('serviceWorker' in navigator)) return

  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs.map(async (reg) => {
        const script =
          reg.active?.scriptURL ||
          reg.waiting?.scriptURL ||
          reg.installing?.scriptURL ||
          ''
        // Parent Badminton PWA SW scope covers /Projects/exam-tracker/ and
        // can serve stale shells that break SPA hash navigation.
        if (
          script.includes('/Projects/sw.js') ||
          /\/Projects\/sw\.js$/.test(script) ||
          script.includes('/Projects/')
        ) {
          await reg.unregister()
        }
      }),
    )
  } catch {
    /* ignore */
  }

  if (!('caches' in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter(
          (k) =>
            k.startsWith('bfm-') ||
            k.includes('badminton') ||
            k.includes('workbox') ||
            k.includes('Projects'),
        )
        .map((k) => caches.delete(k)),
    )
  } catch {
    /* ignore */
  }
}
