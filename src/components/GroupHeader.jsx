import React from 'react';
import { UserCircle2, Bell, LogOut, ArrowLeftCircle, House } from 'lucide-react';

const GroupHeader = ({
  group,
  role,
  user,
  onLogout,
  onBackToGroups,
  pendingRequests = [],
  unreadRequestCount = 0,
  onOpenRequestCenter,
  onOpenProfile,
  onGoHome,
}) => {
  const displayIdentity = user?.name
    ? `${user.name} (${user.email || ''})`
    : (user?.email || 'Guest');

  const roleBadgeClass = role === 'admin'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : role === 'member'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  const showRequestButton = role === 'admin' && onOpenRequestCenter;
  const topActionGridClass = showRequestButton ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="theme-topbar px-3 sm:px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="theme-card rounded-2xl px-3 sm:px-4 py-3 border border-slate-200/70">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Group Workspace</div>
              <div className="font-bold text-slate-900 text-lg truncate">{group?.name}</div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${roleBadgeClass}`}>
                  {role}
                </span>
                <span className="text-xs text-slate-600 truncate max-w-full">{displayIdentity}</span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col gap-2">
              <div className={`grid ${topActionGridClass} sm:flex sm:items-center gap-2`}>
                {user && onOpenProfile && (
                  <button
                    onClick={onOpenProfile}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 min-h-[46px]"
                    title="Open profile"
                  >
                    <UserCircle2 size={18} />
                    <span className="text-sm font-semibold">Profile</span>
                  </button>
                )}
                {onGoHome && (
                  <button
                    onClick={onGoHome}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 min-h-[46px]"
                    title="Go home"
                  >
                    <House size={18} />
                    <span className="text-sm font-semibold">Home</span>
                  </button>
                )}
                {showRequestButton && (
                  <button
                    onClick={onOpenRequestCenter}
                    className="relative w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 min-h-[46px]"
                    title="Open request center"
                  >
                    <Bell size={18} />
                    <span className="text-sm font-semibold">Requests</span>
                    {pendingRequests.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-slate-900 text-white text-[11px]">
                        {pendingRequests.length}
                      </span>
                    )}
                    {unreadRequestCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[10px]">
                        {Math.min(unreadRequestCount, 9)}
                      </span>
                    )}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                {onBackToGroups && (
                  <button
                    onClick={onBackToGroups}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 min-h-[46px]"
                  >
                    <ArrowLeftCircle size={18} />
                    <span className="text-sm font-semibold">Groups</span>
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 min-h-[46px]"
                >
                  <LogOut size={18} />
                  <span className="text-sm font-semibold">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupHeader;
