import { getDefaultAvatarUrl, normalizePhotoInput } from '../utils/playerPhotos';

describe('player photos utils', () => {
  it('builds deterministic default avatar url', () => {
    const alex = getDefaultAvatarUrl('Alex');
    const alex2 = getDefaultAvatarUrl('Alex');
    const ben = getDefaultAvatarUrl('Ben');

    expect(alex).toContain('dicebear');
    expect(alex).toBe(alex2);
    expect(alex).not.toBe(ben);
  });

  it('normalizes valid photo input and rejects invalid values', () => {
    expect(normalizePhotoInput(' https://example.com/a.png ')).toBe('https://example.com/a.png');
    expect(normalizePhotoInput('data:image/png;base64,abc')).toContain('data:image/png;base64');
    expect(normalizePhotoInput('javascript:alert(1)')).toBe('');
    expect(normalizePhotoInput('')).toBe('');
  });
});
