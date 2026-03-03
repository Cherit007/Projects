import React from 'react';

const statusBadge = (status) => {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const GroupRequestsCenter = ({
  group,
  pendingRequests = [],
  recentReviews = [],
  onApproveRequest,
  onRejectRequest,
  onBack,
  loading,
}) => {
  return (
    <div className="theme-page request-center-page min-h-screen p-4 sm:p-6">
      <div className="max-w-5xl mx-auto grid gap-4 sm:gap-5">
        <section className="theme-card request-center-hero rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Admin</p>
              <h1 className="theme-title text-2xl sm:text-4xl font-bold mt-1">Request Center</h1>
              <p className="text-sm text-slate-600 mt-2">{group?.name} membership requests</p>
            </div>
            <button
              onClick={onBack}
              className="request-center-back-btn px-4 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white/70 hover:bg-white"
            >
              Back
            </button>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <div className="request-center-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pending Requests</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{pendingRequests.length}</p>
            </div>
            <div className="request-center-metric rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Recent Decisions</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{recentReviews.length}</p>
            </div>
          </div>
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
