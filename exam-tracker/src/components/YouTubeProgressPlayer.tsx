import { useEffect, useRef } from 'react'
import { youtubeWatchUrl } from '../utils/videoLibrary'

type YTPlayer = {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
}

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiLoader: Promise<void> | null = null

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiLoader) return apiLoader
  apiLoader = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.dataset.ytApi = '1'
      document.head.appendChild(s)
    }
    // Already loaded race
    if (window.YT?.Player) resolve()
  })
  return apiLoader
}

type Props = {
  videoId: string
  onProgress: (info: {
    watchedSec: number
    durationSec: number
    pct: number
  }) => void
}

/**
 * Embeds YouTube with IFrame API and reports peak watch progress.
 * Only works while watching inside ExamPulse (not the YouTube app/tab).
 */
export function YouTubeProgressPlayer({ videoId, onProgress }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const peakRef = useRef(0)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  useEffect(() => {
    let cancelled = false
    let poll: number | undefined
    peakRef.current = 0

    const report = () => {
      const p = playerRef.current
      if (!p) return
      try {
        const duration = p.getDuration()
        const current = p.getCurrentTime()
        if (!duration || duration <= 0) return
        peakRef.current = Math.max(peakRef.current, current)
        const pct = Math.min(
          100,
          Math.round((peakRef.current / duration) * 100),
        )
        onProgressRef.current({
          watchedSec: peakRef.current,
          durationSec: duration,
          pct,
        })
      } catch {
        /* player not ready */
      }
    }

    void loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return
      // Clear previous iframe
      hostRef.current.innerHTML = ''
      const mount = document.createElement('div')
      hostRef.current.appendChild(mount)
      playerRef.current = new window.YT.Player(mount, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            report()
            poll = window.setInterval(report, 2000)
          },
          onStateChange: (e) => {
            report()
            if (e.data === window.YT?.PlayerState.ENDED) {
              const p = playerRef.current
              if (!p) return
              try {
                const duration = p.getDuration()
                onProgressRef.current({
                  watchedSec: duration,
                  durationSec: duration,
                  pct: 100,
                })
              } catch {
                /* ignore */
              }
            }
          },
        },
      })
    })

    return () => {
      cancelled = true
      if (poll) window.clearInterval(poll)
      try {
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
    }
  }, [videoId])

  // Fallback noscript-style link for crawlers; player replaces inner content
  return (
    <div className="yt-player-wrap">
      <div ref={hostRef} className="yt-player-host" />
      <a
        className="yt-fallback-link"
        href={youtubeWatchUrl(videoId)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on YouTube ↗
      </a>
    </div>
  )
}
