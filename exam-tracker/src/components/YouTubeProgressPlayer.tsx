import { useEffect, useRef } from 'react'
import { youtubeWatchUrl } from '../utils/videoLibrary'

type YTPlayer = {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
      }
    },
  ) => YTPlayer
  PlayerState: {
    UNSTARTED: number
    ENDED: number
    PLAYING: number
    PAUSED: number
    BUFFERING: number
    CUED: number
  }
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
    if (window.YT?.Player) resolve()
  })
  return apiLoader
}

type Props = {
  videoId: string
  /** Resume playback near last watched second */
  startSeconds?: number
  /** Known peak so we never report lower % after resume */
  initialPeakSec?: number
  onProgress: (info: {
    watchedSec: number
    durationSec: number
    pct: number
    auto: true
  }) => void
}

/**
 * Embeds YouTube with IFrame API and reports peak watch progress automatically
 * from the player (current time ÷ duration). Requires watching inside ExamPulse.
 */
export function YouTubeProgressPlayer({
  videoId,
  startSeconds = 0,
  initialPeakSec = 0,
  onProgress,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const peakRef = useRef(0)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  useEffect(() => {
    let cancelled = false
    let poll: number | undefined
    const resumeAt =
      startSeconds > 5 && Number.isFinite(startSeconds)
        ? Math.floor(startSeconds)
        : 0
    peakRef.current = Math.max(0, initialPeakSec, resumeAt)

    const report = (forcePct?: number) => {
      const p = playerRef.current
      if (!p) return
      try {
        const duration = p.getDuration()
        const current = p.getCurrentTime()
        if (!duration || duration <= 0) return
        peakRef.current = Math.max(peakRef.current, current)
        const rawPct =
          forcePct !== undefined
            ? forcePct
            : (peakRef.current / duration) * 100
        const pct = Math.min(100, Math.round(rawPct))
        onProgressRef.current({
          watchedSec: forcePct === 100 ? duration : peakRef.current,
          durationSec: duration,
          pct,
          auto: true,
        })
      } catch {
        /* player not ready */
      }
    }

    void loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return
      hostRef.current.innerHTML = ''
      const mount = document.createElement('div')
      hostRef.current.appendChild(mount)
      const playerVars: Record<string, string | number> = {
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      }
      if (resumeAt > 0) playerVars.start = resumeAt

      playerRef.current = new window.YT.Player(mount, {
        videoId,
        playerVars,
        events: {
          onReady: (e) => {
            if (resumeAt > 0) {
              try {
                e.target.seekTo(resumeAt, true)
              } catch {
                /* ignore */
              }
            }
            report()
            poll = window.setInterval(report, 1000)
          },
          onStateChange: (e) => {
            report()
            if (e.data === window.YT?.PlayerState.ENDED) {
              report(100)
            }
            // Persist immediately on pause
            if (e.data === window.YT?.PlayerState.PAUSED) {
              report()
            }
          },
        },
      })
    })

    const onHide = () => report()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      if (poll) window.clearInterval(poll)
      try {
        report()
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
    }
    // Only remount when the video changes — resume args are seed values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

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
