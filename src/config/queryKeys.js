export const queryKeys = {
  authCurrentUser: ['auth', 'current-user'],
  publicGroups: ['groups', 'public'],
  userGroups: (userId) => ['groups', 'user', userId],
  userPendingGroupIds: (userId) => ['groups', 'pending', userId],
  adminPendingRequests: (groupId, userId) => ['groups', 'admin', groupId, 'pending', userId],
  adminRecentReviews: (groupId, userId) => ['groups', 'admin', groupId, 'recent', userId],
  adminGroupMembers: (groupId, userId) => ['groups', 'admin', groupId, 'members', userId],
  appwriteData: (groupId) => ['appwrite', 'bootstrap', groupId || 'nogroup'],
  tournamentSummaries: (groupId) => ['tournaments', 'summaries', groupId || 'nogroup'],
  tournamentHistory: (groupId) => ['tournaments', 'history', groupId || 'nogroup'],
  tournamentDetail: (groupId, tournamentId) => ['tournaments', 'detail', groupId || 'nogroup', String(tournamentId || '')],
  casualMatches: (groupId) => ['casual-matches', groupId || 'nogroup'],
};
