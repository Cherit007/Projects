import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Image, BarChart3 } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import PlayerPhotoEditorModal from './profile/PlayerPhotoEditorModal';
import PlayerProfileModal from './PlayerProfileModal';

const UserProfileModal = ({
  user,
  role = 'viewer',
  linkedPlayerName = '',
  photoUrl = '',
  linkCandidates = [],
  memberProfiles = [],
  unlinkedPlayers = [],
  adminAccounts = [],
  profile,
  team,
  advancedStats,
  achievements,
  gamification,
  leaderboardRank = null,
  onClose,
  onSaveName,
  onSavePhoto,
  onManualLink,
  onAdminLinkAccountToMember,
  onCreateAndLinkOwnMember,
  saving = false,
}) => {
  const initialName = (user?.name || user?.email?.split('@')[0] || '').trim();
  const [name, setName] = useState(initialName);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showFullStats, setShowFullStats] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedAdminAccountId, setSelectedAdminAccountId] = useState('');
  const [selectedAdminPlayerName, setSelectedAdminPlayerName] = useState('');

  useEffect(() => {
    setName((user?.name || user?.email?.split('@')[0] || '').trim());
  }, [user?.name, user?.email]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, []);

  const canEditPhoto = Boolean(linkedPlayerName);
  const canManualLink = !linkedPlayerName;
  const canLinkOthers = role === 'admin';
  const unlinkedPlayerProfiles = useMemo(
    () => (memberProfiles || []).filter((member) => !member.linkedAccountId && !member.linkedEmail),
    [memberProfiles]
  );
  const unlinkedRegisteredAccounts = useMemo(() => {
    const linkedIds = new Set(
      (memberProfiles || [])
        .map((member) => member.linkedAccountId)
        .filter(Boolean)
    );
    const linkedEmails = new Set(
      (memberProfiles || [])
        .map((member) => (member.linkedEmail || '').toLowerCase())
        .filter(Boolean)
    );

    return (adminAccounts || []).filter((account) => {
      const accountEmail = (account.email || '').toLowerCase();
      return !linkedIds.has(account.userId) && !linkedEmails.has(accountEmail);
    });
  }, [adminAccounts, memberProfiles]);

  return (
    <div className="fixed inset-0 z-[260] bg-black/50 flex items-center justify-center p-4 user-profile-overlay app-overlay">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden user-profile-shell app-modal-shell flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-5 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-white text-lg font-bold">My Profile</h3>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2" aria-label="Close profile">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          <div className="flex items-center gap-3">
            <PlayerAvatar name={linkedPlayerName || name || user?.email || 'Player'} photoUrl={photoUrl} size="lg" />
            <div className="min-w-0">
              <p className="text-sm text-slate-500">Account</p>
              <p className="font-semibold text-slate-800 truncate">{user?.email}</p>
              <p className="text-xs text-slate-500 mt-1">
                {linkedPlayerName ? `Linked player: ${linkedPlayerName}` : 'No linked player profile yet'}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2"
              placeholder="Your display name"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSaveName?.(name)}
              disabled={saving || !name.trim()}
              className="user-profile-primary-btn flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={16} /> Save Name
            </button>
            <button
              type="button"
              onClick={() => setShowPhotoEditor(true)}
              disabled={!canEditPhoto || saving}
              className="user-profile-secondary-btn flex-1 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Image size={16} /> Edit Photo
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowFullStats(true)}
            disabled={!linkedPlayerName}
            className="user-profile-stats-btn w-full px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <BarChart3 size={16} /> View Full Stats Profile
          </button>

          {!canEditPhoto && (
            <div className="space-y-2">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Photo editing is enabled after your account is linked to a player profile.
              </p>
              {canManualLink && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 user-profile-link-card">
                  <p className="text-xs font-semibold text-slate-700">Manual Link</p>
                  {canLinkOthers && (
                    <>
                      <select
                        value={selectedMemberId}
                        onChange={(event) => setSelectedMemberId(event.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
                      >
                        <option value="">Select an existing unlinked member</option>
                        {unlinkedPlayerProfiles.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onManualLink?.(selectedMemberId)}
                        disabled={!selectedMemberId || saving || unlinkedPlayerProfiles.length === 0}
                        className="w-full px-3 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        Link Selected Member
                      </button>
                    </>
                  )}
                  {!canLinkOthers && (
                    <p className="text-xs text-slate-600">Only admin can link other members.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onCreateAndLinkOwnMember?.()}
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Create & Link with My Name
                  </button>
                </div>
              )}
            </div>
          )}

          {canLinkOthers && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2 user-profile-admin-card">
              <p className="text-xs font-semibold text-sky-800">Admin Link Center</p>
              <select
                value={selectedAdminAccountId}
                onChange={(event) => setSelectedAdminAccountId(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
              >
                <option value="">Select unlinked registered account</option>
                {unlinkedRegisteredAccounts.map((account) => (
                  <option key={`${account.userId}-${account.id}`} value={account.userId}>
                    {(account.name || account.email)} ({account.role})
                  </option>
                ))}
              </select>
              <select
                value={selectedAdminPlayerName}
                onChange={(event) => setSelectedAdminPlayerName(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
              >
                <option value="">Select unlinked player/profile</option>
                {(unlinkedPlayers || []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onAdminLinkAccountToMember?.(selectedAdminAccountId, selectedAdminPlayerName)}
                disabled={!selectedAdminAccountId || !selectedAdminPlayerName || saving || unlinkedRegisteredAccounts.length === 0 || (unlinkedPlayers || []).length === 0}
                className="w-full px-3 py-2 rounded-lg bg-sky-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                Link Account to Member
              </button>
              {(unlinkedRegisteredAccounts.length === 0 || (unlinkedPlayers || []).length === 0) && (
                <p className="text-[11px] text-slate-600">
                  {unlinkedRegisteredAccounts.length === 0 ? 'No unlinked registered accounts available.' : 'No unlinked players available from stats data.'}
                </p>
              )}
              <p className="text-[11px] text-sky-700">
                This links selected account identity to the selected member/player profile.
              </p>
            </div>
          )}
        </div>
      </div>

      {showPhotoEditor && canEditPhoto && (
        <PlayerPhotoEditorModal
          playerName={linkedPlayerName}
          onSave={(dataUrl) => {
            onSavePhoto?.(linkedPlayerName, dataUrl);
            setShowPhotoEditor(false);
          }}
          onClose={() => setShowPhotoEditor(false)}
        />
      )}
      {showFullStats && linkedPlayerName && (
        <PlayerProfileModal
          playerName={linkedPlayerName}
          profile={profile}
          team={team}
          advancedStats={advancedStats}
          achievements={achievements}
          gamification={gamification}
          leaderboardRank={leaderboardRank}
          photoUrl={photoUrl}
          isLinked
          canEditPhoto
          onUpdatePhoto={onSavePhoto}
          onClose={() => setShowFullStats(false)}
        />
      )}
    </div>
  );
};

export default UserProfileModal;
