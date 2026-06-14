import React, { useMemo, useState } from 'react';

const GroupAccessScreen = ({
  user,
  groups = [],
  publicGroups = [],
  requestedGroupIds = [],
  onCreateGroup,
  onRequestAccess,
  onWatchGroup,
  onSelectGroup,
  loading,
  onLogout,
  isGuest,
  groupMode = 'cloud',
}) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const displayIdentity = user?.name
    ? `${user.name} (${user.email || ''})`
    : (user?.email || 'Guest');
  const hasGroups = useMemo(() => groups.length > 0, [groups]);
  const trimmedGroupName = groupName.trim();
  const membershipByGroupId = useMemo(() => {
    const map = new Map();
    groups.forEach((group) => map.set(group.id, group.role));
    return map;
  }, [groups]);

  const roleBadgeClass = (role) => {
    if (role === 'admin') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (role === 'member') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const groupInitials = (name = '') => {
    const words = name.split(' ').filter(Boolean).slice(0, 2);
    return words.map(word => word[0]?.toUpperCase()).join('') || 'G';
  };

  const filteredPublicGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return publicGroups.filter((group) => {
      const membershipRole = membershipByGroupId.get(group.id);
      const isMember = Boolean(membershipRole);
      const isRequested = requestedGroupIds.includes(group.id);
      const matchesQuery = !query || (group.name || '').toLowerCase().includes(query);

      if (!matchesQuery) return false;
      if (filterMode === 'joined') return isMember;
      if (filterMode === 'requested') return isRequested;
      if (filterMode === 'open') return !isMember && !isRequested;
      return true;
    });
  }, [publicGroups, membershipByGroupId, requestedGroupIds, searchQuery, filterMode]);

  return (
    <div className="theme-page group-hub-page min-h-screen p-4 sm:p-6">
      <div className="max-w-6xl mx-auto grid gap-4 sm:gap-5">
        <div className="theme-card group-hub-hero rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Access</p>
              <h1 className="theme-title text-2xl sm:text-4xl font-bold mt-1">Group Hub</h1>
              <p className="text-sm text-slate-600 mt-2">{isGuest ? 'Guest viewer mode' : `Signed in as ${displayIdentity}`}</p>
              {groupMode === 'demo' && (
                <p className="text-sm text-amber-700 mt-2">
                  Demo mode: group access data is stored only on this device.
                </p>
              )}
              {groupMode === 'unconfigured' && (
                <p className="text-sm text-rose-700 mt-2">
                  Group cloud collections are not configured. Enable explicit demo mode or finish the Appwrite group setup.
                </p>
              )}
            </div>
            <button
              onClick={onLogout}
              className="group-hub-logout-btn px-4 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white/70"
            >
              Logout
            </button>
          </div>
          <div className="mt-5 grid sm:grid-cols-3 gap-3">
            <div className="group-hub-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Groups You Are In</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{groups.length}</p>
            </div>
            <div className="group-hub-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Available Groups</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{publicGroups.length}</p>
            </div>
            <div className="group-hub-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Requests Pending</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{requestedGroupIds.length}</p>
            </div>
          </div>
        </div>

        {!isGuest && hasGroups && (
          <div className="theme-card group-hub-joined rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Your Groups</h2>
            <div className="mt-3 grid gap-2">
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => onSelectGroup(group)}
                  className="group-hub-group-btn text-left p-3 border border-slate-200 rounded-xl bg-white/70 hover:border-slate-400 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-slate-900 text-white text-xs font-semibold grid place-items-center">
                        {groupInitials(group.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{group.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Open workspace</div>
                      </div>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-full border ${roleBadgeClass(group.role)}`}>
                      {group.role}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-4 ${isGuest ? '' : 'md:grid-cols-2'}`}>
          {!isGuest && (
            <div className="theme-card group-hub-create rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Create Group</h2>
              <p className="text-sm text-slate-600 mt-1">Create a workspace and become its admin.</p>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 mt-3 bg-white/85"
              />
              <button
                onClick={() => onCreateGroup(trimmedGroupName)}
                disabled={loading || !trimmedGroupName}
                className="btn-brand mt-3 w-full py-2.5 rounded-xl font-semibold disabled:opacity-50"
              >
                Create Group
              </button>
            </div>
          )}

          <div className="theme-card group-hub-available rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Available Groups</h2>
            <p className="text-sm text-slate-600 mt-1">Watch instantly. Logged-in users can request membership.</p>
            <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groups..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white/85"
              />
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white/85 text-sm"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="joined">Joined</option>
                <option value="requested">Requested</option>
              </select>
            </div>
            <div className="mt-3 grid gap-2 max-h-[420px] overflow-auto pr-1">
              {filteredPublicGroups.length === 0 && (
                <div className="group-hub-empty text-sm text-slate-500 border border-slate-200 rounded-xl p-3 bg-white/70">No groups available yet</div>
              )}
              {filteredPublicGroups.map((group) => {
                const membershipRole = membershipByGroupId.get(group.id);
                const isMember = Boolean(membershipRole);
                const isViewerMember = membershipRole === 'viewer';
                const isRequested = requestedGroupIds.includes(group.id);
                return (
                  <div key={group.id} className="group-hub-public-item border border-slate-200 rounded-xl p-3 bg-white/70">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-slate-800 text-white text-xs font-semibold grid place-items-center">
                          {groupInitials(group.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{group.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {isMember ? `Your role: ${membershipRole}` : 'Publicly discoverable'}
                          </div>
                        </div>
                      </div>
                      {isRequested && (
                        <span className="text-[11px] px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          pending
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => onWatchGroup(group)}
                        disabled={loading}
                        className="group-hub-watch-btn px-3 py-1.5 rounded-md border border-slate-300 text-sm bg-white"
                      >
                        Watch
                      </button>
                      {isMember && !isViewerMember ? (
                        <button
                          onClick={() => onSelectGroup(groups.find(item => item.id === group.id) || { ...group, role: 'member' })}
                          disabled={loading}
                          className="btn-brand px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                        >
                          Open as Member
                        </button>
                      ) : !isGuest && user ? (
                        <button
                          onClick={() => onRequestAccess(group.id)}
                          disabled={loading || isRequested}
                          className="btn-brand-alt px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                        >
                          {isRequested ? 'Requested' : isViewerMember ? 'Request Member Access' : 'Request Entry'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupAccessScreen;
