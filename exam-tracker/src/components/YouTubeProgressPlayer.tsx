import { useEffect, useRef } from 'react'
import { normalizePlaybackRate, youtubeWatchUrl } from '../utils/videoLibrary'

type YTPlayer = {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  getPlaybackRate?: () => number
  setPlaybackRate?: (rate: number) => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
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
        onPlaybackRateChange?: (e: { data: number; target: YTPlayer }) => void
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
    const done = () => resolve()
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      done()
    }
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.dataset.ytApi = '1'
      document.head.appendChild(s)
    }
    if (window.YT?.Player) {
      done()
      return
    }
    const started = Date.now()
    const poll = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(poll)
        done()
      } else if (Date.now() - started > 12000) {
        window.clearInterval(poll)
        done()
      }
    }, 50)
  })
  return apiLoader
}

type Props = {
  videoId: string
  /** Resume playback at this second */
  startSeconds?: number
  /** Known peak so we never report lower % after resume */
  initialPeakSec?: number
  /** Trusted full video length from prior sessions (guards against ad durations) */
  knownDurationSec?: number | null
  /** Persisted playback speed for this video */
  playbackRate?: number
  /** Bump this object to seek+play at seconds (timestamp notes) */
  seekRequest?: { seconds: number; nonce: number } | null
  onEnded?: () => void
  onPlaybackRateChange?: (rate: number) => void
  onProgress: (info: {
    watchedSec: number
    durationSec: number
    pct: number
    auto: true
  }) => void
}

/**
 * Embeds YouTube with IFrame API and reports peak watch progress.
 * Ignores mid-roll ad duration spikes that would corrupt resume %.
 */
export function YouTubeProgressPlayer({
  videoId,
  startSeconds = 0,
  initialPeakSec = 0,
  knownDurationSec = null,
  playbackRate = 1,
  seekRequest = null,
  onEnded,
  onPlaybackRateChange,
  onProgress,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const peakRef = useRef(0)
  const trustedDurationRef = useRef<number | null>(
    knownDurationSec && knownDurationSec > 0 ? knownDurationSec : null,
  )
  const rateRef = useRef(normalizePlaybackRate(playbackRate))
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  const onRateRef = useRef(onPlaybackRateChange)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded
  onRateRef.current = onPlaybackRateChange
  rateRef.current = normalizePlaybackRate(playbackRate)

  useEffect(() => {
    if (knownDurationSec && knownDurationSec > 0) {
      trustedDurationRef.current = Math.max(
        trustedDurationRef.current ?? 0,
        knownDurationSec,
      )
    }
  }, [knownDurationSec])

  useEffect(() => {
    const p = playerRef.current
    const rate = normalizePlaybackRate(playbackRate)
    rateRef.current = rate
    if (!p?.setPlaybackRate) return
    try {
      const current = p.getPlaybackRate?.() ?? 1
      if (Math.abs(current - rate) > 0.01) p.setPlaybackRate(rate)
    } catch {
      /* ignore */
    }
  }, [playbackRate])

  useEffect(() => {
    let cancelled = false
    let poll: number | undefined
    const resumeAt =
      startSeconds > 3 && Number.isFinite(startSeconds)
        ? Math.floor(startSeconds)
        : 0
    peakRef.current = Math.max(0, initialPeakSec, resumeAt)
    if (knownDurationSec && knownDurationSec > 0) {
      trustedDurationRef.current = knownDurationSec
    }

    const acceptDuration = (raw: number): number | null => {
      if (!raw || raw <= 0 || !Number.isFinite(raw)) return null
      const trusted = trustedDurationRef.current
      // Mid-roll ads often expose a short duration (15–60s). Reject those once
      // we already know the real video length.
      if (trusted && trusted > 90 && raw < trusted * 0.5) return null
      if (trusted && raw > trusted * 1.35) return null
      // Learn / reinforce trusted duration when it looks like a real video.
      if (!trusted || raw >= (trusted ?? 0)) {
        if (raw >= 30) trustedDurationRef.current = raw
      }
      return trustedDurationRef.current ?? raw
    }

    const applyRate = (target: YTPlayer) => {
      try {
        target.setPlaybackRate?.(rateRef.current)
      } catch {
        /* ignore */
      }
    }

    const report = (opts?: { forceEnd?: boolean }) => {
      const p = playerRef.current
      if (!p || !window.YT) return
      try {
        const state = p.getPlayerState()
        const PS = window.YT.PlayerState
        // Skip buffering / cued / unstarted — ad transitions are noisy here
        if (
          !opts?.forceEnd &&
          state !== PS.PLAYING &&
          state !== PS.PAUSED &&
          state !== PS.ENDED
        ) {
          return
        }

        const rawDuration = p.getDuration()
        const duration = acceptDuration(rawDuration)
        if (!duration) return

        let current = p.getCurrentTime()
        if (!Number.isFinite(current) || current < 0) return
        // Clamp to trusted length (ads can report odd clocks)
        current = Math.min(current, duration)

        // Ignore tiny forward blips until we've actually resumed near peak
        if (
          resumeAt > 10 &&
          current < resumeAt * 0.4 &&
          state === PS.PLAYING &&
          peakRef.current >= resumeAt
        ) {
          // Likely still in an ad or pre-roll before seek settles
          return
        }

        peakRef.current = Math.max(peakRef.current, current)
        // Never let peak exceed trusted duration
        peakRef.current = Math.min(peakRef.current, duration)

        const pct = opts?.forceEnd
          ? 100
          : Math.min(100, Math.round((peakRef.current / duration) * 100))

        onProgressRef.current({
          watchedSec: opts?.forceEnd
            ? duration
            : Math.floor(peakRef.current),
          durationSec: Math.round(duration),
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
        iv_load_policy: 3,
      }
      if (resumeAt > 0) playerVars.start = resumeAt

      playerRef.current = new window.YT.Player(mount, {
        videoId,
        playerVars,
        events: {
          onReady: (e) => {
            applyRate(e.target)
            if (resumeAt > 0) {
              try {
                e.target.seekTo(resumeAt, true)
              } catch {
                /* ignore */
              }
            }
            // Delay first report so pre-roll ad duration doesn't win
            window.setTimeout(() => report(), 800)
            poll = window.setInterval(() => report(), 1200)
          },
          onStateChange: (e) => {
            if (e.data === window.YT?.PlayerState.ENDED) {
              report({ forceEnd: true })
              onEndedRef.current?.()
              return
            }
            if (
              e.data === window.YT?.PlayerState.PLAYING ||
              e.data === window.YT?.PlayerState.PAUSED
            ) {
              applyRate(e.target)
              report()
            }
          },
          onPlaybackRateChange: (e) => {
            const rate = normalizePlaybackRate(e.data)
            rateRef.current = rate
            onRateRef.current?.(rate)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useEffect(() => {
    if (!seekRequest) return
    const p = playerRef.current
    if (!p) return
    try {
      const capped = Math.max(0, Math.floor(seekRequest.seconds))
      p.seekTo(capped, true)
      peakRef.current = Math.max(peakRef.current, capped)
      p.playVideo()
    } catch {
      /* ignore */
    }
  }, [seekRequest])

  return (
    <div className="yt-player-wrap">
      <div ref={hostRef} className="yt-player-host" />
      <noscript>
        <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
          Open on YouTube
        </a>
      </noscript>
    </div>
  )
}
