import React from 'react';
import { Link2 } from 'lucide-react';

const AccountLinkPromptModal = ({ prompt, onConfirm, onSkip }) => {
  if (!prompt) return null;

  const targetName = prompt.memberName || prompt.playerName || prompt.displayName || 'this player';
  const isMemberPrompt = prompt.type === 'member';

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Link2 size={18} />
            <h3 className="font-bold text-lg">Link Account</h3>
          </div>
          <p className="text-cyan-100 text-sm mt-1">Connect your login with an existing player profile</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-700">
            {isMemberPrompt
              ? `Found existing member "${targetName}" in this group. Do you want to link your account to this member?`
              : `Found existing player "${targetName}" in this tournament/group. Do you want to link your account to this player?`}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Linked accounts get profile ownership and will show as linked in members/profile.
          </p>
          <div className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onSkip}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Link now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountLinkPromptModal;
