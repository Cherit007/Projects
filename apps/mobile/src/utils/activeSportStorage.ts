import { DEFAULT_SPORT_ID, resolveSportId } from '@fixture-maker/domain/sports';
import { nativeStorage } from '@fixture-maker/storage/native';

const STORAGE_KEY = 'fixture-maker:last-sport-by-group';

const readMap = async (): Promise<Record<string, string>> => {
  const parsed = await nativeStorage.getJson(STORAGE_KEY, null);
  return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
};

export const getLastSportForGroup = async (groupId: string | null | undefined) => {
  const key = String(groupId || 'local').trim() || 'local';
  const map = await readMap();
  return resolveSportId(map[key] || DEFAULT_SPORT_ID);
};

export const setLastSportForGroup = async (groupId: string | null | undefined, sportId: string) => {
  const key = String(groupId || 'local').trim() || 'local';
  const map = await readMap();
  map[key] = resolveSportId(sportId);
  await nativeStorage.setJson(STORAGE_KEY, map);
};
