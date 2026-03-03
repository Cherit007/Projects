import { useEffect } from 'react';

export const useMemberLinkEffect = ({
  requiresAuth,
  currentUser,
  activeGroup,
  groupRole,
  isGuestViewer,
  loading,
  members,
  playerDatabase,
  teams,
  pendingLinkPrompt,
  setPendingLinkPrompt,
  setMembers,
  saveMembersToLocal,
  linkPromptedRef,
}) => {
  useEffect(() => {
    // Show account-link flow only for approved group members.
    if (!requiresAuth || !currentUser || !activeGroup || groupRole !== 'member' || isGuestViewer || loading) return;
    const email = (currentUser.email || '').toLowerCase();
    const accountName = (currentUser.name || '').trim();
    const emailLocalPart = (currentUser.email || '').split('@')[0]?.trim() || '';
    const displayName = (accountName || emailLocalPart || currentUser.email || '').trim();
    if (!displayName) return;
    const normalizedName = displayName.toLowerCase();
    const currentTournamentPlayers = (teams || [])
      .flatMap((team) => [team?.player, team?.player1, team?.player2])
      .filter(Boolean);
    const knownPlayers = [...new Set([...(playerDatabase || []), ...currentTournamentPlayers])];
    const matchedPlayerName = knownPlayers.find(
      (playerName) => (playerName || '').trim().toLowerCase() === normalizedName
    );

    const linkedByIdentity = members.find((member) => (
      member.linkedAccountId === currentUser.$id
      || ((member.linkedEmail || '').toLowerCase() === email)
    ));

    if (linkedByIdentity) {
      if (pendingLinkPrompt) setPendingLinkPrompt(null);
      const patched = {
        ...linkedByIdentity,
        linkedAccountId: currentUser.$id,
        linkedEmail: currentUser.email,
        name: linkedByIdentity.name || displayName,
      };
      if (JSON.stringify(patched) !== JSON.stringify(linkedByIdentity)) {
        const updated = members.map((member) => (
          member.id === linkedByIdentity.id ? patched : member
        ));
        setMembers(updated);
        saveMembersToLocal(updated);
      }
      return;
    }

    // If this name already has a linked profile in the group, skip prompting.
    const alreadyLinkedByName = members.some((member) => (
      Boolean(member.linkedAccountId || member.linkedEmail)
      && (member.name || '').trim().toLowerCase() === normalizedName
    ));
    if (alreadyLinkedByName) {
      if (pendingLinkPrompt) setPendingLinkPrompt(null);
      return;
    }

    const sameNameMembers = members.filter(
      (member) => (member.name || '').trim().toLowerCase() === normalizedName
    );
    const hasLinkedSameName = sameNameMembers.some(
      (member) => Boolean(member.linkedAccountId || member.linkedEmail)
    );
    const unlinkedSameName = sameNameMembers.find(
      (member) => !member.linkedAccountId && !member.linkedEmail
    );

    if (pendingLinkPrompt) return;

    // Ask before linking an existing same-name unlinked member.
    if (unlinkedSameName && !hasLinkedSameName) {
      const promptKey = `${activeGroup.id}:${currentUser.$id}:member:${normalizedName}`;
      if (linkPromptedRef.current.has(promptKey)) return;
      linkPromptedRef.current.add(promptKey);
      setPendingLinkPrompt({
        type: 'member',
        promptKey,
        memberId: unlinkedSameName.id,
        memberName: unlinkedSameName.name,
        displayName,
      });
      return;
    }

    // If player exists in tournament/player database but no member profile exists yet, ask to link that player identity.
    if (matchedPlayerName && sameNameMembers.length === 0 && !hasLinkedSameName) {
      const promptKey = `${activeGroup.id}:${currentUser.$id}:playerdb:${normalizedName}`;
      if (linkPromptedRef.current.has(promptKey)) return;
      linkPromptedRef.current.add(promptKey);
      setPendingLinkPrompt({
        type: 'player',
        promptKey,
        playerName: matchedPlayerName,
        displayName,
      });
      return;
    }

    // If no member with this name exists, create a linked profile member for the account.
    if (sameNameMembers.length === 0) {
      const next = [{
        id: `member-${Date.now()}`,
        name: displayName,
        phone: '',
        linkedAccountId: currentUser.$id,
        linkedEmail: currentUser.email,
      }, ...members];
      setMembers(next);
      saveMembersToLocal(next);
    }
  }, [requiresAuth, currentUser, activeGroup, groupRole, isGuestViewer, members, playerDatabase, teams, loading, pendingLinkPrompt]);

  useEffect(() => {
    if (groupRole !== 'member' && pendingLinkPrompt) {
      setPendingLinkPrompt(null);
    }
  }, [groupRole, pendingLinkPrompt]);
};

