export const STORAGE_KEYS = Object.freeze({
  THEME_MODE: 'bfm:theme-mode',
  HISTORY: 'bfm:history',
  RATINGS: 'bfm:ratings',
  PLAYERS: 'bfm:players',
  MEMBERS: 'bfm:members',
  TEMPLATES: 'bfm:templates',
  PLAYER_PHOTOS: 'bfm:player-photos',
  CASUAL_MATCHES: 'bfm:casual-matches',
  GROUP_META: 'bfm:group-meta',
  ACTIVE_TOURNAMENT_CACHE: 'bfm:appwrite-active-tournament',
  OFFLINE_OUTBOX: 'bfm:offline-outbox:v1',
  QUERY_CACHE: 'bfm:rq-cache:v2',
  QUERY_CACHE_LEGACY: 'bfm:rq-cache:v1',
});

export const SESSION_STORAGE_KEYS = Object.freeze({
  AUTO_RESUME_SUPPRESS: 'bfm:skip-auto-resume-tournament',
});

/** @type {Record<string, string>} canonical key → legacy localStorage key */
export const LEGACY_LOCAL_STORAGE_KEYS = Object.freeze({
  [STORAGE_KEYS.THEME_MODE]: 'badminton_theme_mode',
  [STORAGE_KEYS.HISTORY]: 'badminton_history',
  [STORAGE_KEYS.RATINGS]: 'badminton_ratings',
  [STORAGE_KEYS.PLAYERS]: 'badminton_players',
  [STORAGE_KEYS.MEMBERS]: 'badminton_members',
  [STORAGE_KEYS.TEMPLATES]: 'badminton_templates',
  [STORAGE_KEYS.PLAYER_PHOTOS]: 'badminton_player_photos',
  [STORAGE_KEYS.CASUAL_MATCHES]: 'badminton_casual_matches',
  [STORAGE_KEYS.GROUP_META]: 'badminton_group_meta',
});

/** @type {Record<string, string>} canonical key → legacy sessionStorage key */
export const LEGACY_SESSION_STORAGE_KEYS = Object.freeze({
  [SESSION_STORAGE_KEYS.AUTO_RESUME_SUPPRESS]: 'badminton_skip_auto_resume_tournament',
});
