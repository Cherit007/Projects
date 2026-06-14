import { updatePlayerRatingsAfterMatch } from '@fixture-maker/domain/scoring';
import { ANALYTICS_EVENTS, trackEvent } from '@fixture-maker/analytics';
import { flushQueuedLocalStorageWrites } from '../../services/localStorageWriteService';
import { webStorage } from '../../platform/storage';
import { STORAGE_KEYS } from '../../platform/storageKeys';
import { queryKeys } from '../../config/queryKeys';
import {
  persistCasualMatchStatisticsBackup,
  removeCasualMatchStatisticsBackup,
} from '../../utils/casualMatchHydration';

const persistLocalCasualMatches = (matches) => {
  webStorage.setJson(STORAGE_KEYS.CASUAL_MATCHES, matches);
  matches.forEach((match) => persistCasualMatchStatisticsBackup(match));
  flushQueuedLocalStorageWrites();
};

const syncCasualMatchesQueryCache = (queryClient, activeGroupId, matches) => {
  if (!queryClient || !activeGroupId) return;
  queryClient.setQueryData(queryKeys.casualMatches(activeGroupId), matches);
};

export const useCasualMatchActions = ({
  assertCanOperate,
  assertCanDelete,
  confirmAction,
  showToast,
  isAppwriteEnabled,
  activeGroupId = null,
  queryClient = null,
  playerRatings,
  setPlayerRatings,
  tournamentHistory,
  casualMatches,
  setCasualMatches,
  setShowCasualMatch,
  onCasualFlowComplete,
  createCasualMatchMutation,
  deleteCasualMatchMutation,
  rebuildPlayerDatabase,
  recalculateEloFromHistory,
}) => {
  const requestConfirmation = async (options = {}) => {
    if (typeof confirmAction !== 'function') return false;
    try {
      const result = await confirmAction(options);
      return Boolean(result);
    } catch {
      return false;
    }
  };

  const yieldToUi = () => new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });

  const saveCasualMatch = async (matchData, options = {}) => {
    const { keepOpen = false } = options;
    if (!assertCanOperate()) {
      return { success: false, error: 'Operation not allowed' };
    }
    try {
      const isBoxCricket = matchData?.sportId === 'boxCricket';
      const winner = matchData.score1 > matchData.score2 ? 'team1' : 'team2';
      const completedAt = new Date().toISOString();
      const matchWithWinner = {
        ...matchData,
        winner,
        completed: true,
        completedAt,
        ...(isBoxCricket ? { matchType: 'team' } : {}),
      };

      const match = {
        id: `casual-${Date.now()}`,
        team1: matchData.team1,
        team2: matchData.team2,
        score1: matchData.score1,
        score2: matchData.score2,
        completed: true,
        completedAt,
        ...(matchData.sportId ? { sportId: matchData.sportId } : {}),
        ...(isBoxCricket ? {
          sportId: 'boxCricket',
          statistics: matchData.statistics,
          matchType: 'team',
        } : {}),
      };

      let updatedRatings = playerRatings;
      if (!isBoxCricket) {
        updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, match);
        setPlayerRatings(updatedRatings);
      }

      if (isAppwriteEnabled) {
        const savedMatch = await createCasualMatchMutation.mutateAsync(matchWithWinner);
        setCasualMatches((prev) => {
          const updatedMatches = [savedMatch, ...prev];
          syncCasualMatchesQueryCache(queryClient, activeGroupId, updatedMatches);
          persistLocalCasualMatches(updatedMatches);
          return updatedMatches;
        });
      } else {
        const localMatch = {
          ...matchWithWinner,
          id: `casual-${Date.now()}`,
          createdAt: new Date().toISOString(),
          completed: true,
        };
        setCasualMatches((prev) => {
          const updatedMatches = [localMatch, ...prev];
          persistLocalCasualMatches(updatedMatches);
          return updatedMatches;
        });
      }

      showToast(isBoxCricket ? '✅ Box cricket match saved!' : '✅ Match recorded & ELO updated!');
      trackEvent(ANALYTICS_EVENTS.CASUAL_MATCH_RECORDED, {
        winner,
        sportId: isBoxCricket ? 'boxCricket' : undefined,
      });
      if (!keepOpen) {
        setShowCasualMatch?.(false);
        onCasualFlowComplete?.();
      }
      return { success: true };
    } catch (error) {
      console.error('Error saving casual match:', error);
      showToast('Failed to save match', 'error');
      return { success: false, error };
    }
  };

  const handleDeleteCasualMatchFromSetup = async (id, options = {}) => {
    const { skipConfirm = false, skipProgressToast = false } = options || {};
    if (!assertCanDelete()) return false;
    if (!skipConfirm) {
      const confirmed = await requestConfirmation({
        title: 'Delete Casual Match',
        message: 'Delete this casual match?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
      if (!confirmed) return false;
    }
    if (!skipProgressToast) {
      showToast('Deleting casual match...');
      await yieldToUi();
    }

    try {
      const updatedCasualMatches = casualMatches.filter((match) => (
        String(match?.id || '').trim() !== String(id || '').trim()
        && String(match?.appwriteId || '').trim() !== String(id || '').trim()
      ));
      const deletedMatch = casualMatches.find((match) => (
        String(match?.id || '').trim() === String(id || '').trim()
        || String(match?.appwriteId || '').trim() === String(id || '').trim()
      ));
      setCasualMatches(updatedCasualMatches);
      syncCasualMatchesQueryCache(queryClient, activeGroupId, updatedCasualMatches);
      removeCasualMatchStatisticsBackup(deletedMatch || id);

      if (!isAppwriteEnabled) {
        persistLocalCasualMatches(updatedCasualMatches);
      }

      const recalculatedRatings = recalculateEloFromHistory(tournamentHistory, updatedCasualMatches);
      setPlayerRatings(recalculatedRatings);

      const persistDeletion = async () => {
        if (isAppwriteEnabled) {
          await deleteCasualMatchMutation.mutateAsync(id);
          await rebuildPlayerDatabase({
            history: tournamentHistory,
            casual: updatedCasualMatches,
            persistCloud: false,
            pruneMissing: false,
          });
          return;
        }

        await rebuildPlayerDatabase({
          history: tournamentHistory,
          casual: updatedCasualMatches,
        });
      };

      if (isAppwriteEnabled) {
        showToast('Casual match deleted');
        void persistDeletion().catch((rebuildError) => {
          console.error('Casual match delete cloud sync failed:', rebuildError);
          showToast('Casual match deleted locally, but cloud sync failed.', 'error');
        });
        return true;
      }

      await persistDeletion();
      showToast('Casual match deleted');
      return true;
    } catch (error) {
      console.error('Error deleting casual match:', error);
      showToast('Failed to delete casual match', 'error');
      return false;
    }
  };

  return {
    saveCasualMatch,
    handleDeleteCasualMatchFromSetup,
  };
};
