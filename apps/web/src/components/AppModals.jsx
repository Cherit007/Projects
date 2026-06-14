import React from 'react';
import AccountLinkPromptModal from './AccountLinkPromptModal';
import UserProfileModal from './UserProfileModal';

const AppModals = ({
  requiresAuth,
  currentUser,
  showProfileModal,
  groupRole,
  currentUserMember,
  playerPhotos,
  members,
  unlinkedPlayerNames,
  adminAccounts,
  currentUserPlayerProfile,
  currentUserPlayerTeam,
  currentUserAdvancedStats,
  currentUserAchievements,
  currentUserGamification,
  currentUserLeaderboardRank,
  tournamentHistory = [],
  casualMatches = [],
  authLoading,
  onSaveProfileName,
  onUpdatePlayerPhoto,
  onManualLink,
  onAdminLinkAccountToMember,
  onCreateAndLinkOwnMember,
  onCloseProfile,
  pendingLinkPrompt,
  onConfirmLinkPrompt,
  onSkipLinkPrompt,
}) => (
  <>
    {requiresAuth && currentUser && showProfileModal && (
      <UserProfileModal
        user={currentUser}
        role={groupRole}
        linkedPlayerName={currentUserMember?.name || ''}
        photoUrl={currentUserMember?.name ? playerPhotos[currentUserMember.name] : ''}
        linkCandidates={(members || []).filter((member) => !member.linkedAccountId && !member.linkedEmail)}
        memberProfiles={members || []}
        unlinkedPlayers={unlinkedPlayerNames}
        adminAccounts={adminAccounts}
        profile={currentUserPlayerProfile}
        team={currentUserPlayerTeam}
        advancedStats={currentUserAdvancedStats}
        achievements={currentUserAchievements}
        gamification={currentUserGamification}
        leaderboardRank={currentUserLeaderboardRank}
        tournamentHistory={tournamentHistory}
        casualMatches={casualMatches}
        saving={authLoading}
        onSaveName={onSaveProfileName}
        onSavePhoto={onUpdatePlayerPhoto}
        onManualLink={onManualLink}
        onAdminLinkAccountToMember={onAdminLinkAccountToMember}
        onCreateAndLinkOwnMember={onCreateAndLinkOwnMember}
        onClose={onCloseProfile}
      />
    )}

    <AccountLinkPromptModal
      prompt={pendingLinkPrompt}
      onConfirm={onConfirmLinkPrompt}
      onSkip={onSkipLinkPrompt}
    />
  </>
);

export default AppModals;
