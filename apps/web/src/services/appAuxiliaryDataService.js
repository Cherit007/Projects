import { appDataService } from './appDataService';
import { groupRosterService } from './groupRosterService';
import { playerService } from './playerService';
import { tournamentTemplatesService } from './tournamentTemplatesService';
import {
  isGroupRosterCollectionEnabled,
  isPlayerPhotoMetadataEnabled,
  isTournamentTemplatesCollectionEnabled,
} from './appAuxiliaryConfig';
import { buildMemberAccountLinks } from '../utils/appHelpers';

const emptyAuxiliaryPayload = () => ({
  templates: [],
  members: [],
  memberAccountLinks: {},
  playerPhotos: {},
});

export const appAuxiliaryDataService = {
  usesV2Templates: isTournamentTemplatesCollectionEnabled,
  usesV2Roster: isGroupRosterCollectionEnabled,
  usesV2PlayerPhotos: isPlayerPhotoMetadataEnabled,

  async loadAuxiliaryData(groupId = null) {
    const [
      templatesFromCollection,
      membersFromCollection,
      playerPhotosFromPlayers,
      metaFallback,
    ] = await Promise.all([
      isTournamentTemplatesCollectionEnabled()
        ? tournamentTemplatesService.listTemplates(groupId)
        : Promise.resolve(null),
      isGroupRosterCollectionEnabled()
        ? groupRosterService.listMembers(groupId)
        : Promise.resolve(null),
      isPlayerPhotoMetadataEnabled()
        ? playerService.getPlayerPhotoRefs(groupId)
        : Promise.resolve(null),
      appDataService.isMetaEnabled()
        ? appDataService.getAppMeta({ groupId }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const templates = templatesFromCollection ?? metaFallback?.templates ?? [];
    const members = membersFromCollection ?? metaFallback?.members ?? [];
    const memberAccountLinks = membersFromCollection
      ? buildMemberAccountLinks(members)
      : (metaFallback?.memberAccountLinks || {});
    const playerPhotos = playerPhotosFromPlayers ?? metaFallback?.playerPhotos ?? {};

    return {
      templates,
      members,
      memberAccountLinks,
      playerPhotos,
    };
  },

  async saveTemplates(templates = [], groupId = null) {
    if (isTournamentTemplatesCollectionEnabled()) {
      return tournamentTemplatesService.saveTemplates(templates, groupId);
    }
    if (!appDataService.isMetaEnabled()) return templates;
    await appDataService.saveAppMeta({ templates }, { groupId });
    return templates;
  },

  async saveMembers(members = [], groupId = null) {
    if (isGroupRosterCollectionEnabled()) {
      return groupRosterService.saveMembers(members, groupId);
    }
    if (!appDataService.isMetaEnabled()) return members;
    await appDataService.saveAppMeta({
      members,
      memberAccountLinks: buildMemberAccountLinks(members),
    }, { groupId });
    return members;
  },

  async savePlayerPhotos(playerPhotos = {}, groupId = null) {
    if (isPlayerPhotoMetadataEnabled()) {
      return playerService.savePlayerPhotoRefs(playerPhotos, groupId);
    }
    if (!appDataService.isMetaEnabled()) return playerPhotos;
    await appDataService.saveAppMeta({ playerPhotos }, { groupId });
    return playerPhotos;
  },

  emptyAuxiliaryPayload,
};
