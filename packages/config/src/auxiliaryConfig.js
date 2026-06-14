import { readEnv } from './readEnv.js';

const DEFAULT_GROUP_ID = 'default-group';

export const isTournamentTemplatesCollectionEnabled = () => Boolean(
  readEnv('VITE_APPWRITE_COLLECTION_TOURNAMENT_TEMPLATES')
);

export const isGroupRosterCollectionEnabled = () => Boolean(
  readEnv('VITE_APPWRITE_COLLECTION_GROUP_ROSTER')
);

export const isPlayerPhotoMetadataEnabled = () => Boolean(
  readEnv('VITE_APPWRITE_COLLECTION_V2_PLAYERS')
);

export const isAuxiliaryV2Enabled = () => (
  isTournamentTemplatesCollectionEnabled()
  || isGroupRosterCollectionEnabled()
  || isPlayerPhotoMetadataEnabled()
);

export const toAuxiliaryGroupId = (groupId) => {
  const value = String(groupId || '').trim();
  return value || DEFAULT_GROUP_ID;
};
