import React from 'react';

const statusBadge = (status) => {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const roleBadge = (role) => {
  if (role === 'admin') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (role === 'member') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const GroupRequestsCenter = ({
  group,
  pendingRequests = [],
  recentReviews = [],
  members = [],
  currentUserId = '',
  onApproveRequest,
  onRejectRequest,
  onPromoteMemberToAdmin,
  onRemoveMember,
  onBack,
  loading,
}) => {
  const sortedMembers = [...members].sort((a, b) => {
    const roleScore = (role) => (role === 'admin' ? 0 : role === 'member' ? 1 : 2);
    const roleDiff = roleScore(a.role) - roleScore(b.role);
    if (roleDiff !== 0) return roleDiff;
    return new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime();
  });
  const adminCount = sortedMembers.filter((member) => member.role === 'admin').length;

  const handleRemoveMember = (member) => {
    if (!member?.userId || !onRemoveMember) return;
    const label = member.name || member.email || 'this member';
    const confirmed = window.confirm(`Remove ${label} from "${group?.name || 'this group'}"?`);
    if (!confirmed) return;
    onRemoveMember(member.userId);
  };

  const canRemoveMember = (member) => {
    if (!member || member.userId === currentUserId) return false;
    if (member.role !== 'admin') return true;
    return adminCount > 1;
  };

  return (
    <div className="theme-page request-center-page min-h-screen p-4 sm:p-6">
      <div className="max-w-5xl mx-auto grid gap-4 sm:gap-5">
        <section className="theme-card request-center-hero rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Admin</p>
              <h1 className="theme-title text-2xl sm:text-4xl font-bold mt-1">Admin Hub</h1>
              <p className="text-sm text-slate-600 mt-2">{group?.name} member management</p>
            </div>
            <button
              onClick={onBack}
              className="request-center-back-btn px-4 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white/70 hover:bg-white"
            >
              Back
            </button>
          </div>
          <div className="mt-5 grid sm:grid-cols-3 gap-3">
            <div className="request-center-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pending Requests</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{pendingRequests.length}</p>
            </div>
            <div className="request-center-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Recent Decisions</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{recentReviews.length}</p>
            </div>
            <div className="request-center-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Members</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{sortedMembers.length}</p>
            </div>
          </div>
        </section>

        <section className="theme-card request-center-members rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Members</h2>
          {sortedMembers.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No members found.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {sortedMembers.map((member) => {
                const isCurrentUser = member.userId === currentUserId;
                const removeAllowed = canRemoveMember(member);
                return (
                  <div key={member.id} className="request-center-member-row flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2 bg-white/70">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{member.name || member.email || 'Unnamed member'}</div>
                      <div className="text-xs text-slate-500 truncate">{member.email || 'No email available'}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleString() : 'Unknown'}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`text-[11px] px-2 py-1 rounded-full border font-semibold ${roleBadge(member.role)}`}>
                        {member.role}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          You
                        </span>
                      )}
                      {!isCurrentUser && member.role !== 'admin' && (
                        <button
                          onClick={() => onPromoteMemberToAdmin?.(member.userId)}
                          disabled={loading}
                          className="request-center-role-btn px-3 py-1.5 rounded-md border border-blue-200 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                        >
                          Make Admin
                        </button>
                      )}
                      {!isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          disabled={loading || !removeAllowed}
                          className="request-center-danger-btn px-3 py-1.5 rounded-md border border-rose-200 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50"
                          title={!removeAllowed && member.role === 'admin' ? 'Cannot remove the last admin' : 'Remove member'}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="theme-card request-center-pending rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Pending</h2>
          {pendingRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No pending requests.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {pendingRequests.map((request) => (
                <div key={request.id} className="request-center-row flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2 bg-white/70">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{request.name || request.email}</div>
                    <div className="text-xs text-slate-500 truncate">{request.email}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Requested {new Date(request.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApproveRequest(request.id)}
                      disabled={loading}
                      className="btn-brand px-3 py-1.5 rounded-md text-xs disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onRejectRequest(request.id)}
                      disabled={loading}
                      className="request-center-reject-btn px-3 py-1.5 rounded-md border border-slate-300 text-xs bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="theme-card request-center-recent rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Approved / Rejected Recently</h2>
          {recentReviews.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No recent decisions yet.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {recentReviews.map((item) => (
                <div key={item.id} className="request-center-row flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2 bg-white/70">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{item.name || item.email}</div>
                    <div className="text-xs text-slate-500 truncate">{item.email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[11px] px-2 py-1 rounded-full border ${statusBadge(item.status)}`}>
                      {item.status}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1">{new Date(item.reviewedAt || item.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default GroupRequestsCenter;
