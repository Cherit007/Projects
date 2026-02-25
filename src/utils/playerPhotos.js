export const getDefaultAvatarUrl = (playerName = '') => {
  const seed = encodeURIComponent((playerName || 'Player').trim());
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`;
};

export const normalizePhotoInput = (value = '') => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  return '';
};
