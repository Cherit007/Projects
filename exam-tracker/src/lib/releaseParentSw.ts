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
        if (script.includes('/Projects/sw.js') || /\/Projects\/sw\.js$/.test(script)) {
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
      keys.filter((k) => k.startsWith('bfm-')).map((k) => caches.delete(k)),
    )
  } catch {
    /* ignore */
  }
}
