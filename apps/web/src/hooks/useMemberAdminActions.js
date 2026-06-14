import { useCallback } from 'react';
import { appAuxiliaryDataService } from '../services/appAuxiliaryDataService';
import { queueLocalStorageJson } from '../services/localStorageWriteService';
import { STORAGE_KEYS } from '../platform/storageKeys';
import { queryKeys } from '../config/queryKeys';
import {
  applyMemberAccountLinks,
  buildMemberAccountLinks,
  mergeMemberLinks,
  mergeMembersForCloudSave,
} from '../utils/appHelpers';

export const useMemberAdminActions = ({
  isAppwriteEnabled = false,
  activeGroup = null,
  currentUser = null,
  currentUserMember = null,
  groupRole = null,
  members = [],
  adminAccounts = [],
  setMembers,
  setAuthLoading,
  setCurrentUser,
  canManageMembers = false,
  assertCanManageMembers = () => true,
  canEditOwnProfile = () => false,
  showToast = () => {},
  updatePlayerDatabase = () => {},
  saveMembersToCloud = async () => {},
  updateProfileName = async () => null,
  queryClient,
}) => {
  const saveMembersToLocal = useCallback((updatedMembers, baselineMembers = members) => {
    const baseline = Array.isArray(baselineMembers) ? baselineMembers : [];
    const safeMembers = mergeMemberLinks(updatedMembers, baseline);
    if (isAppwriteEnabled) {
      void (async () => {
        let mergedForCloud = safeMembers;
        try {
          const remoteAuxiliary = await appAuxiliaryDataService.loadAuxiliaryData(activeGroup?.id);
          const remoteMembersRaw = Array.isArray(remoteAuxiliary?.members) ? remoteAuxiliary.members : [];
          const remoteLinks = remoteAuxiliary?.memberAccountLinks && typeof remoteAuxiliary.memberAccountLinks === 'object'
            ? remoteAuxiliary.memberAccountLinks
            : {};
          const remoteMembers = applyMemberAccountLinks(
            mergeMemberLinks(remoteMembersRaw, safeMembers),
            remoteLinks
          );
          mergedForCloud = mergeMembersForCloudSave({
            nextMembers: safeMembers,
            baselineMembers: baseline,
            remoteMembers,
          });
        } catch (error) {
          console.error('Failed to merge latest member links before save:', error);
        }

        try {
          await saveMembersToCloud({
            members: mergedForCloud,
            memberAccountLinks: buildMemberAccountLinks(mergedForCloud),
          });
        } catch (error) {
          console.error('Failed to save members to Appwrite:', error);
        }
      })();
      return;
    }
    queueLocalStorageJson(STORAGE_KEYS.MEMBERS, safeMembers);
  }, [activeGroup?.id, isAppwriteEnabled, members, saveMembersToCloud]);

  const handleManualLinkToMember = useCallback((memberId) => {
    if (!currentUser) return;
    if (groupRole !== 'admin') {
      showToast('Only admin can link other members', 'error');
      return;
    }
    const target = members.find((member) => member.id === memberId);
    if (!target) {
      showToast('Selected member not found', 'error');
      return;
    }
    const linkedToOther = (target.linkedAccountId && target.linkedAccountId !== currentUser.$id)
      || (target.linkedEmail && target.linkedEmail.toLowerCase() !== (currentUser.email || '').toLowerCase());
    if (linkedToOther) {
      showToast('This member is already linked to another account', 'error');
      return;
    }

    const updated = members.map((member) => (
      member.id === memberId
        ? {
            ...member,
            linkedAccountId: currentUser.$id,
            linkedEmail: currentUser.email,
          }
        : member
    ));
    setMembers(updated);
    saveMembersToLocal(updated, members);
    showToast(`Linked account to "${target.name}"`);
  }, [currentUser, groupRole, members, saveMembersToLocal, setMembers, showToast]);

  const handleCreateAndLinkOwnMember = useCallback(() => {
    if (!currentUser) return;
    const displayName = (currentUser.name || currentUser.email?.split('@')[0] || '').trim();
    if (!displayName) {
      showToast('Unable to resolve account name for linking', 'error');
      return;
    }

    const existing = members.find((member) => (member.name || '').trim().toLowerCase() === displayName.toLowerCase());
    if (existing) {
      handleManualLinkToMember(existing.id);
      return;
    }

    const next = [{
      id: `member-${Date.now()}`,
      name: displayName,
      phone: '',
      linkedAccountId: currentUser.$id,
      linkedEmail: currentUser.email,
    }, ...members];
    setMembers(next);
    saveMembersToLocal(next, members);
    showToast(`Created and linked "${displayName}"`);
  }, [currentUser, handleManualLinkToMember, members, saveMembersToLocal, setMembers, showToast]);

  const applyAccountLink = useCallback((prompt) => {
    if (!prompt || !currentUser) return;

    if (prompt.type === 'member' && prompt.memberId) {
      const updated = members.map((member) => (
        member.id === prompt.memberId
          ? {
              ...member,
              linkedAccountId: currentUser.$id,
              linkedEmail: currentUser.email,
            }
          : member
      ));
      setMembers(updated);
      saveMembersToLocal(updated, members);
      showToast(`Linked to member "${prompt.memberName}"`);
      return;
    }

    if (prompt.type === 'player' && prompt.playerName) {
      const next = [{
        id: `member-${Date.now()}`,
        name: prompt.playerName,
        phone: '',
        linkedAccountId: currentUser.$id,
        linkedEmail: currentUser.email,
      }, ...members];
      setMembers(next);
      saveMembersToLocal(next);
      showToast(`Linked to player "${prompt.playerName}"`);
    }
  }, [currentUser, members, saveMembersToLocal, setMembers, showToast]);

  const handleSaveProfileName = useCallback(async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed || !currentUser) return;

    setAuthLoading(true);
    try {
      const updatedUser = await updateProfileName(trimmed);
      queryClient.setQueryData(queryKeys.authCurrentUser, updatedUser);
      setCurrentUser(updatedUser);
      showToast('Profile name updated');
    } catch (error) {
      console.error('Failed to update profile name:', error);
      showToast(error?.message || 'Failed to update profile name', 'error');
    } finally {
      setAuthLoading(false);
    }
  }, [currentUser, queryClient, setAuthLoading, setCurrentUser, showToast, updateProfileName]);

  const handleAdminLinkAccountToMember = useCallback((accountUserId, playerName) => {
    if (!currentUser || groupRole !== 'admin') {
      showToast('Only admin can link member accounts', 'error');
      return;
    }
    const account = adminAccounts.find((item) => item.userId === accountUserId);
    const targetName = (playerName || '').trim();
    if (!account || !targetName) {
      showToast('Please select both account and player profile', 'error');
      return;
    }
    const existingTarget = members.find((member) => (member.name || '').trim().toLowerCase() === targetName.toLowerCase());
    const targetId = existingTarget?.id || `member-${Date.now()}`;
    const targetPhone = existingTarget?.phone || '';

    const accountEmail = (account.email || '').toLowerCase();
    const baseMembers = existingTarget
      ? [...members]
      : [{ id: targetId, name: targetName, phone: targetPhone }, ...members];
    const updated = baseMembers.map((member) => {
      const sameLinkedAccount = member.linkedAccountId && member.linkedAccountId === account.userId;
      const sameLinkedEmail = accountEmail && (member.linkedEmail || '').toLowerCase() === accountEmail;
      if (member.id === targetId) {
        return {
          ...member,
          name: targetName,
          phone: member.phone || targetPhone,
          linkedAccountId: account.userId,
          linkedEmail: account.email,
        };
      }
      if (sameLinkedAccount || sameLinkedEmail) {
        return { ...member, linkedAccountId: undefined, linkedEmail: undefined };
      }
      return member;
    });

    setMembers(updated);
    saveMembersToLocal(updated, members);
    showToast(`Linked ${account.name || account.email} to ${targetName}`);
  }, [adminAccounts, currentUser, groupRole, members, saveMembersToLocal, setMembers, showToast]);

  const addMember = useCallback((memberData) => {
    if (!canManageMembers) {
      const ownName = memberData?.name?.trim();
      if (!canEditOwnProfile(ownName)) {
        showToast('Only admin can manage all members', 'error');
        return { success: false, reason: 'Only admin can manage all members' };
      }
    }
    const name = memberData?.name?.trim();
    const phone = memberData?.phone?.trim();
    if (!name || !phone) return { success: false, reason: 'Name and phone are required' };

    let memberAdded = null;
    setMembers((prev) => {
      const existing = prev.find((member) => member.name.toLowerCase() === name.toLowerCase());
      const normalizedMember = {
        id: existing?.id || `member-${Date.now()}`,
        name,
        phone,
        linkedAccountId: existing?.linkedAccountId || (currentUserMember?.name?.toLowerCase() === name.toLowerCase() ? currentUser?.$id : undefined),
        linkedEmail: existing?.linkedEmail || (currentUserMember?.name?.toLowerCase() === name.toLowerCase() ? currentUser?.email : undefined),
      };
      const updated = existing
        ? prev.map((member) => (member.id === existing.id ? normalizedMember : member))
        : [...prev, normalizedMember];

      saveMembersToLocal(updated, prev);
      memberAdded = existing ? { ...normalizedMember, updated: true } : normalizedMember;
      return updated;
    });

    updatePlayerDatabase(name);
    return { success: true, member: memberAdded };
  }, [
    canEditOwnProfile,
    canManageMembers,
    currentUser,
    currentUserMember,
    saveMembersToLocal,
    setMembers,
    showToast,
    updatePlayerDatabase,
  ]);

  const deleteMember = useCallback((memberId) => {
    if (!assertCanManageMembers()) return;
    setMembers((prev) => {
      const updated = prev.filter((member) => member.id !== memberId);
      saveMembersToLocal(updated);
      return updated;
    });
  }, [assertCanManageMembers, saveMembersToLocal, setMembers]);

  return {
    saveMembersToLocal,
    applyAccountLink,
    handleSaveProfileName,
    handleManualLinkToMember,
    handleAdminLinkAccountToMember,
    handleCreateAndLinkOwnMember,
    addMember,
    deleteMember,
  };
};
