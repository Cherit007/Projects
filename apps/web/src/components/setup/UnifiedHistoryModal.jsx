import React from 'react';
import { History, X } from 'lucide-react';
import MobileBottomSheet from '../common/MobileBottomSheet';
import UnifiedHistoryContent from './UnifiedHistoryContent';

const LoadingRows = ({ rows = 4 }) => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="h-16 rounded-xl bg-gray-100" />
    ))}
  </div>
);

const UnifiedHistoryModal = ({
  open,
  onClose,
  isMobileViewport = false,
  entryCount = 0,
  entries = [],
  isLoading = false,
  showSkeleton = false,
  onViewTournament,
  onViewCasualMatch,
  onDeleteTournament,
  onDeleteCasualMatch,
  canDeleteActions = false,
  isPendingAction = () => false,
  formatCasualTeam,
  formatCasualMatchMeta,
  formatCasualScoreLine,
}) => {
  if (!open) return null;

  const contentProps = {
    entries,
    isLoading,
    showSkeleton,
    onViewTournament,
    onViewCasualMatch,
    onDeleteTournament,
    onDeleteCasualMatch,
    canDeleteActions,
    isPendingAction,
    formatCasualTeam,
    formatCasualMatchMeta,
    formatCasualScoreLine,
  };

  if (isMobileViewport) {
    return (
      <MobileBottomSheet
        open={open}
        title="History"
        subtitle={`${entryCount} tournaments & casual matches`}
        onClose={onClose}
        sheetClassName="history-modal-shell"
      >
        {showSkeleton ? (
          <LoadingRows rows={4} />
        ) : (
          <UnifiedHistoryContent {...contentProps} />
        )}
      </MobileBottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden history-modal-shell app-modal-shell">
        <div className="app-gradient-band p-6 flex items-center justify-between setup-modal-header setup-modal-header-history">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <History size={24} /> History
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-88px)]">
          {showSkeleton ? (
            <LoadingRows rows={4} />
          ) : (
            <UnifiedHistoryContent {...contentProps} />
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedHistoryModal;
