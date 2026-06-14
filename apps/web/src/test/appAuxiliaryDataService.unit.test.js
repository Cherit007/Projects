// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/appAuxiliaryConfig', () => ({
  isTournamentTemplatesCollectionEnabled: () => true,
  isGroupRosterCollectionEnabled: () => true,
  isPlayerPhotoMetadataEnabled: () => true,
}));

vi.mock('../services/tournamentTemplatesService', () => ({
  tournamentTemplatesService: {
    isEnabled: () => true,
    listTemplates: vi.fn(async () => [{ id: 't1', name: 'League' }]),
    saveTemplates: vi.fn(async (_templates) => [{ id: 't1', name: 'League' }]),
  },
}));

vi.mock('../services/groupRosterService', () => ({
  groupRosterService: {
    isEnabled: () => true,
    listMembers: vi.fn(async () => [{ id: 'm1', name: 'Alex', phone: '1' }]),
    saveMembers: vi.fn(async (members) => members),
  },
}));

vi.mock('../services/playerService', () => ({
  playerService: {
    getPlayerPhotoRefs: vi.fn(async () => ({ Alex: { fileId: 'f1', type: 'storage' } })),
    savePlayerPhotoRefs: vi.fn(async (refs) => refs),
  },
}));

vi.mock('../services/appDataService', () => ({
  appDataService: {
    isMetaEnabled: () => false,
    getAppMeta: vi.fn(),
    saveAppMeta: vi.fn(),
  },
}));

import { appAuxiliaryDataService } from '../services/appAuxiliaryDataService';
import { buildMemberAccountLinks } from '../utils/appHelpers';

describe('appAuxiliaryDataService', () => {
  it('loads auxiliary data from V2 collections', async () => {
    const result = await appAuxiliaryDataService.loadAuxiliaryData('g-1');

    expect(result.templates[0].name).toBe('League');
    expect(result.members[0].name).toBe('Alex');
    expect(result.memberAccountLinks).toEqual(buildMemberAccountLinks(result.members));
    expect(result.playerPhotos.Alex.fileId).toBe('f1');
  });
});
