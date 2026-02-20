import { useState, useEffect, useCallback } from 'react';
import { isAppwriteConfigured } from '../appwrite.config';
import { tournamentService } from '../services/tournamentService';
import { playerService } from '../services/playerService';

/**
 * Custom hook to manage Appwrite sync with session state
 */
export const useAppwriteSync = (showToast) => {
  const [isAppwriteEnabled, setIsAppwriteEnabled] = useState(false);
  const [isConfigChecked, setIsConfigChecked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTournamentId, setCurrentTournamentId] = useState(null);

  // Check if Appwrite is configured on mount
  useEffect(() => {
    const enabled = isAppwriteConfigured();
    setIsAppwriteEnabled(enabled);
    
    if (enabled) {
      console.log('✅ Appwrite integration enabled');
    } else {
      console.log('⚠️ Appwrite not configured - check .env file');
    }
    setIsConfigChecked(true);
  }, []);

  /**
   * Load session state from sessionStorage (for page refresh)
   */
  const loadSessionState = useCallback(() => {
    try {
      const saved = sessionStorage.getItem('badminton_session_state');
      if (saved) {
        const state = JSON.parse(saved);
        console.log('📥 Session state available');
        return state;
      }
    } catch (error) {
      console.error('Error loading session state:', error);
    }
    return null;
  }, []);

  /**
   * Save session state to sessionStorage
   */
  const saveSessionState = useCallback((state) => {
    try {
      sessionStorage.setItem('badminton_session_state', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving session state:', error);
    }
  }, []);

  /**
   * Clear session state
   */
  const clearSessionState = useCallback(() => {
    try {
      sessionStorage.removeItem('badminton_session_state');
    } catch (error) {
      console.error('Error clearing session state:', error);
    }
  }, []);

  /**
   * Load all data from Appwrite
   */
  const loadFromAppwrite = async () => {
    if (!isAppwriteEnabled) return null;

    try {
      setIsSyncing(true);

      const [tournaments, playerDb, ratings] = await Promise.all([
        tournamentService.getAllTournaments(),
        playerService.getPlayerDatabase(),
        playerService.getPlayerRatings(),
      ]);

      return {
        tournaments: tournaments || [],
        playerDatabase: playerDb?.players || [],
        playerRatings: ratings?.ratings || {},
      };
    } catch (error) {
      console.error('Error loading from Appwrite:', error);
      showToast?.('Failed to load from cloud', 'error');
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Save tournament to Appwrite
   */
  const saveTournamentToAppwrite = async (tournament) => {
    if (!isAppwriteEnabled) return tournament;

    try {
      let savedTournament;

      if (tournament.appwriteId) {
        // Update existing tournament
        savedTournament = await tournamentService.updateTournament(
          tournament.appwriteId,
          tournament
        );
      } else {
        // Create new tournament
        savedTournament = await tournamentService.createTournament(tournament);
        setCurrentTournamentId(savedTournament.id);
      }

      return savedTournament;
    } catch (error) {
      console.error('Error saving tournament to Appwrite:', error);
      showToast?.('Failed to sync to cloud', 'error');
      return tournament; // Return original if save fails
    }
  };

  /**
   * Delete tournament from Appwrite
   */
  const deleteTournamentFromAppwrite = async (tournamentId) => {
    if (!isAppwriteEnabled) return true;

    try {
      await tournamentService.deleteTournament(tournamentId);
      return true;
    } catch (error) {
      console.error('Error deleting tournament from Appwrite:', error);
      showToast?.('Failed to delete from cloud', 'error');
      return false;
    }
  };

  /**
   * Save player ratings to Appwrite
   */
  const saveRatingsToAppwrite = async (ratings) => {
    if (!isAppwriteEnabled) return ratings;

    try {
      await playerService.savePlayerRatings(ratings);
      return ratings;
    } catch (error) {
      console.error('Error saving ratings to Appwrite:', error);
      // Don't show toast for ratings - silent fail
      return ratings;
    }
  };

  /**
   * Save player database to Appwrite
   */
  const savePlayerDatabaseToAppwrite = async (players) => {
    if (!isAppwriteEnabled) return players;

    try {
      await playerService.savePlayerDatabase(players);
      return players;
    } catch (error) {
      console.error('Error saving player database to Appwrite:', error);
      return players;
    }
  };

  /**
   * Sync current tournament state to Appwrite
   */
  const syncCurrentTournament = async (tournamentData) => {
    if (!isAppwriteEnabled || !currentTournamentId) return;

    try {
      await tournamentService.updateTournament(currentTournamentId, {
        fixtures: tournamentData.fixtures,
        bracket: tournamentData.bracket,
        champion: tournamentData.champion,
        finalMatch: tournamentData.finalMatch,
        status: tournamentData.champion ? 'completed' : 'active',
      });
    } catch (error) {
      console.error('Error syncing tournament:', error);
    }
  };

  return {
    isAppwriteEnabled,
    isConfigChecked,
    isSyncing,
    currentTournamentId,
    setCurrentTournamentId,
    loadSessionState,
    saveSessionState,
    clearSessionState,
    loadFromAppwrite,
    saveTournamentToAppwrite,
    deleteTournamentFromAppwrite,
    saveRatingsToAppwrite,
    savePlayerDatabaseToAppwrite,
    syncCurrentTournament,
  };
};
