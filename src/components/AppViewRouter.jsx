import React, { Suspense, lazy } from 'react';
import BadmintonLoader from './BadmintonLoader';

const SetupScreen = lazy(() => import('./SetupScreen'));
const TeamEntry = lazy(() => import('./Teamentry'));
const TournamentView = lazy(() => import('./Tournamentview'));
const CasualMatch = lazy(() => import('./CasualMatch'));
const AuthScreen = lazy(() => import('./AuthScreen'));
const GroupAccessScreen = lazy(() => import('./GroupAccessScreen'));
const GroupHeader = lazy(() => import('./GroupHeader'));
const ViewerDashboard = lazy(() => import('./ViewerDashboard'));
const GroupRequestsCenter = lazy(() => import('./GroupRequestsCenter'));

const ScreenFallback = () => (
  <BadmintonLoader label="Loading... Preparing your court..." />
);

const AppViewRouter = ({
  isConfigChecked,
  authResolved,
  groupResolved,
  requiresAuth,
  currentUser,
  isGuestViewer,
  activeGroup,
  groupRole,
  showRequestCenter,
  isViewerMode,
  authLoading,
  availableGroups,
  publicGroups,
  requestedGroupIds,
  unreadRequestCount,
  pendingJoinRequests,
  recentJoinReviews,
  adminGroupMembers,
  currentUserId,
  inviteLoading,
  onLogin,
  onRegister,
  onContinueAsViewer,
  onCreateGroup,
  onRequestAccess,
  onWatchGroup,
  onSelectGroup,
  onOpenProfile,
  onGoHome,
  onBackToGroups,
  onOpenRequestCenter,
  onLogout,
  onCloseRequestCenter,
  onApproveRequest,
  onRejectRequest,
  onPromoteMemberToAdmin,
  onRemoveGroupMember,
  onConfirmAction,
  viewerDashboardProps,
  setupScreenProps,
  teamEntryProps,
  tournamentViewProps,
  casualMatchProps,
  showCasualMatch,
  appModals,
  isMobileViewport = false,
}) => {
  if (!isConfigChecked || !authResolved || !groupResolved) {
    return <ScreenFallback />;
  }

  if (requiresAuth && !currentUser && !isGuestViewer) {
    return (
      <>
        <Suspense fallback={<ScreenFallback />}>
          <AuthScreen
            onLogin={onLogin}
            onRegister={onRegister}
            onContinueAsViewer={onContinueAsViewer}
            loading={authLoading}
          />
        </Suspense>
      </>
    );
  }

  if (requiresAuth && !activeGroup) {
    return (
      <>
        <Suspense fallback={<ScreenFallback />}>
          <GroupAccessScreen
            user={currentUser}
            groups={availableGroups}
            publicGroups={publicGroups}
            requestedGroupIds={requestedGroupIds}
            onCreateGroup={onCreateGroup}
            onRequestAccess={onRequestAccess}
            onWatchGroup={onWatchGroup}
            onSelectGroup={onSelectGroup}
            loading={authLoading}
            onLogout={onLogout}
            isGuest={isGuestViewer}
          />
        </Suspense>
      </>
    );
  }

  if (requiresAuth && activeGroup && !groupRole) {
    return (
      <>
        <Suspense fallback={<ScreenFallback />}>
          <GroupAccessScreen
            user={currentUser}
            groups={availableGroups}
            publicGroups={publicGroups}
            requestedGroupIds={requestedGroupIds}
            onCreateGroup={onCreateGroup}
            onRequestAccess={onRequestAccess}
            onWatchGroup={onWatchGroup}
            onSelectGroup={onSelectGroup}
            loading={authLoading}
            onLogout={onLogout}
            isGuest={isGuestViewer}
          />
        </Suspense>
      </>
    );
  }

  if (requiresAuth && groupRole === 'admin' && showRequestCenter) {
    return (
      <>
        <Suspense fallback={<ScreenFallback />}>
          <GroupHeader
            group={activeGroup}
            role={groupRole}
            user={currentUser}
            isMobileViewport={isMobileViewport}
            onOpenProfile={onOpenProfile}
            onGoHome={onGoHome}
            onBackToGroups={onBackToGroups}
            pendingRequests={pendingJoinRequests}
            unreadRequestCount={unreadRequestCount}
            onOpenRequestCenter={onOpenRequestCenter}
            onLogout={onLogout}
          />
          <GroupRequestsCenter
            group={activeGroup}
            pendingRequests={pendingJoinRequests}
            recentReviews={recentJoinReviews}
            members={adminGroupMembers}
            currentUserId={currentUserId}
            onApproveRequest={onApproveRequest}
            onRejectRequest={onRejectRequest}
            onPromoteMemberToAdmin={onPromoteMemberToAdmin}
            onRemoveMember={onRemoveGroupMember}
            onConfirmAction={onConfirmAction}
            loading={inviteLoading}
            onBack={onCloseRequestCenter}
          />
        </Suspense>
        {appModals}
      </>
    );
  }

  if (isViewerMode) {
    return (
      <>
        <Suspense fallback={<ScreenFallback />}>
          <GroupHeader
            group={activeGroup}
            role={groupRole}
            user={currentUser}
            isMobileViewport={isMobileViewport}
            onOpenProfile={onOpenProfile}
            onGoHome={onGoHome}
            onBackToGroups={onBackToGroups}
            pendingRequests={pendingJoinRequests}
            unreadRequestCount={unreadRequestCount}
            onOpenRequestCenter={groupRole === 'admin' ? onOpenRequestCenter : undefined}
            onLogout={onLogout}
          />
          <ViewerDashboard {...viewerDashboardProps} />
        </Suspense>
        {appModals}
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<ScreenFallback />}>
        {requiresAuth && (
          <GroupHeader
            group={activeGroup}
            role={groupRole}
            user={currentUser}
            isMobileViewport={isMobileViewport}
            onOpenProfile={onOpenProfile}
            onGoHome={onGoHome}
            onBackToGroups={onBackToGroups}
            pendingRequests={pendingJoinRequests}
            unreadRequestCount={unreadRequestCount}
            onOpenRequestCenter={groupRole === 'admin' ? onOpenRequestCenter : undefined}
            onLogout={onLogout}
          />
        )}
        {setupScreenProps.step === 'setup' && <SetupScreen {...setupScreenProps} />}
        {teamEntryProps.step === 'teams' && <TeamEntry {...teamEntryProps} />}
        {tournamentViewProps.step === 'tournament' && <TournamentView {...tournamentViewProps} />}
        {showCasualMatch && <CasualMatch {...casualMatchProps} />}
      </Suspense>
      {appModals}
    </>
  );
};

export default React.memo(AppViewRouter);
