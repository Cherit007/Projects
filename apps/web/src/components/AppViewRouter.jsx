import React, { Suspense, lazy } from 'react';
import BadmintonLoader from './BadmintonLoader';
import { APP_ROUTE_KEYS } from '../utils/appRoutes';

const SetupScreen = lazy(() => import('./SetupScreen'));
const TeamEntry = lazy(() => import('./Teamentry.tsx'));
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
  routeKey = null,
  groupServiceMode = 'cloud',
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
  onDeleteGroup,
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
  const currentRouteKey = routeKey || (() => {
    if (requiresAuth && !currentUser && !isGuestViewer) return APP_ROUTE_KEYS.AUTH;
    if (requiresAuth && groupRole === 'admin' && showRequestCenter) return APP_ROUTE_KEYS.GROUP_REQUESTS;
    if (requiresAuth && !activeGroup) return APP_ROUTE_KEYS.GROUPS;
    if (isViewerMode) return APP_ROUTE_KEYS.VIEWER;
    if (tournamentViewProps.step === 'tournament') return APP_ROUTE_KEYS.TOURNAMENT;
    if (teamEntryProps.step === 'teams') return APP_ROUTE_KEYS.TEAMS;
    return APP_ROUTE_KEYS.SETUP;
  })();

  if (!isConfigChecked || !authResolved || !groupResolved) {
    return <ScreenFallback />;
  }

  if (currentRouteKey === APP_ROUTE_KEYS.AUTH) {
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

  if (currentRouteKey === APP_ROUTE_KEYS.GROUPS) {
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
            groupMode={groupServiceMode}
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
            groupMode={groupServiceMode}
          />
        </Suspense>
      </>
    );
  }

  if (currentRouteKey === APP_ROUTE_KEYS.GROUP_REQUESTS) {
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
            onDeleteGroup={onDeleteGroup}
            onConfirmAction={onConfirmAction}
            loading={inviteLoading}
            onBack={onCloseRequestCenter}
          />
        </Suspense>
        {appModals}
      </>
    );
  }

  if (currentRouteKey === APP_ROUTE_KEYS.VIEWER) {
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
        {currentRouteKey === APP_ROUTE_KEYS.SETUP && <SetupScreen {...setupScreenProps} />}
        {currentRouteKey === APP_ROUTE_KEYS.TEAMS && <TeamEntry {...teamEntryProps} />}
        {currentRouteKey === APP_ROUTE_KEYS.TOURNAMENT && <TournamentView {...tournamentViewProps} />}
        {showCasualMatch && <CasualMatch {...casualMatchProps} />}
      </Suspense>
      {appModals}
    </>
  );
};

export default React.memo(AppViewRouter);
