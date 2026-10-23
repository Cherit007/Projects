type Listener = (message: string) => void

const listeners = new Set<Listener>()

export function showToast(message: string) {
  listeners.forEach((l) => l(message))
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
