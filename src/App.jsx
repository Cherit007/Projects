import React, { useState, useEffect, useMemo } from 'react';
import SetupScreen from './components/SetupScreen';
import TeamEntry from './components/TeamEntry';
import TournamentView from './components/Tournamentview';
import CasualMatch from './components/CasualMatch';
import Toast from './components/Toast';
import { useAppwriteSync } from './hooks/useAppwriteSync';
import { casualMatchService } from './services/casualmatchservice';
import { getInvitablePlayers } from './utils/invitations';
import {
  calculatePointsTable, 
  calculatePlayerStats, 
  calculateCumulativePlayerStats,
  generateFixtures as createFixtures,
  updatePlayerRatingsAfterMatch,
  getPlayerLeaderboard,
  generateKnockoutBracket,
  updateBracket
} from './utils/calculations';
import { buildPairingAnalytics } from './utils/pairingAnalytics';
import { buildFormPowerRankings } from './utils/formPowerRankings';
import { predictMatchOutcome, getUpsetAlert } from './utils/matchPredictions';
import { normalizePhotoInput } from './utils/playerPhotos';
import { buildPlayerAchievements } from './utils/playerAchievements';
import { buildAiMatchSummary, detectNewlyUnlockedBadges } from './utils/matchSummary';
import { playerPhotoStorageService } from './services/playerPhotoStorageService';

const App = () => {
  const normalizeTournamentFormat = (value) =>
    value === 'playInFinal' ? 'knockoutByes' : value;
  const normalizeTemplateTeams = (teamsData = [], templateGameMode = 'doubles', templateNumTeams = 3) => {
    const safeNumTeams = Math.max(3, parseInt(templateNumTeams, 10) || 3);
    return Array.from({ length: safeNumTeams }, (_, index) => {
      const rawTeam = teamsData[index] || {};
      const player1 = rawTeam.player1 || rawTeam.player || '';
      return {
        id: index + 1,
        emoji: rawTeam.emoji || '🏸',
        name: rawTeam.name || '',
        player1,
        player: player1,
        player2: templateGameMode === 'singles' ? '' : (rawTeam.player2 || ''),
      };
    });
  };

  // State
  const [step, setStep] = useState('setup');
  const [tournamentName, setTournamentName] = useState('');
  const [numTeams, setNumTeams] = useState(3);
  const [format, setFormat] = useState('1');
  const [gameMode, setGameMode] = useState('doubles');
  const [tournamentFormat, setTournamentFormat] = useState('league');
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [bracket, setBracket] = useState([]);
  const [champion, setChampion] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playerDatabase, setPlayerDatabase] = useState([]);
  const [members, setMembers] = useState([]);
  const [playerRatings, setPlayerRatings] = useState({});
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [casualMatches, setCasualMatches] = useState([]);
  const [showCasualMatch, setShowCasualMatch] = useState(false);
  const [lastTournamentConfig, setLastTournamentConfig] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCasualHistory, setShowCasualHistory] = useState(false);
  const [showAllTimeStats, setShowAllTimeStats] = useState(false);
  const [showEloLeaderboard, setShowEloLeaderboard] = useState(false);
  const [tournamentTemplates, setTournamentTemplates] = useState([]);
  const [playerPhotos, setPlayerPhotos] = useState({});
  const [playerPhotoRefs, setPlayerPhotoRefs] = useState({});
  const [pendingPrefilledTeams, setPendingPrefilledTeams] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [aiMatchSummaries, setAiMatchSummaries] = useState([]);

  const hydratePlayerPhotos = (rawPhotos = {}) => {
    const urls = {};
    const refs = {};
    Object.entries(rawPhotos || {}).forEach(([name, value]) => {
      if (!name) return;
      if (typeof value === 'string') {
        urls[name] = value;
        return;
      }

      if (value && typeof value === 'object' && value.fileId) {
        refs[name] = value;
        const storageUrl = playerPhotoStorageService.getPhotoUrl(value.fileId);
        if (storageUrl) urls[name] = storageUrl;
      }
    });
    return { urls, refs };
  };
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  // Appwrite Integration
  const {
    isAppwriteEnabled,
    isConfigChecked,
    isSyncing,
    currentTournamentId,
    setCurrentTournamentId,
    sessionState,
    loadSessionState,
    saveSessionState,
    clearSessionState,
    loadFromAppwrite,
    saveTournamentToAppwrite,
    deleteTournamentFromAppwrite,
    saveRatingsToAppwrite,
    savePlayerDatabaseToAppwrite,
    saveMembersToAppwrite,
    saveTemplatesToAppwrite,
    savePlayerPhotosToAppwrite,
    syncCurrentTournament,
  } = useAppwriteSync(showToast);

  // Load data on mount - Appwrite only
  useEffect(() => {
    if (!isConfigChecked) return;

    let mounted = true;
  
    const loadInitialData = async () => {
      setLoading(true);
    
      try {
        const localMembers = JSON.parse(localStorage.getItem("badminton_members") || "[]");
        const localTemplates = JSON.parse(localStorage.getItem("badminton_templates") || "[]");
        const localPhotos = JSON.parse(localStorage.getItem("badminton_player_photos") || "{}");

        // 1️⃣ Load session state always
        const savedSession = await loadSessionState();
        if (mounted && savedSession) {
          setStep(savedSession.step);
          setTournamentName(savedSession.tournamentName);
          setNumTeams(savedSession.numTeams);
          setFormat(savedSession.format);
          setGameMode(savedSession.gameMode);
          setTournamentFormat(normalizeTournamentFormat(savedSession.tournamentFormat));
          setTeams(savedSession.teams || []);
          setFixtures(savedSession.fixtures || []);
          setBracket(savedSession.bracket || []);
          setChampion(savedSession.champion);
          setAiMatchSummaries(savedSession.aiMatchSummaries || []);
          setCurrentTournamentId(savedSession.currentTournamentId);
        }
    
        // 2️⃣ LOCAL MODE SUPPORT
        if (!isAppwriteEnabled) {
          console.log("Running in LOCAL MODE");
    
          const localPlayers = JSON.parse(localStorage.getItem("badminton_players") || "[]");
          const localRatings = JSON.parse(localStorage.getItem("badminton_ratings") || "{}");
          const localHistory = JSON.parse(localStorage.getItem("badminton_history") || "[]");
          const localCasualMatches = JSON.parse(localStorage.getItem("badminton_casual_matches") || "[]");
    
          if (mounted) {
            setMembers(localMembers);
            const { urls, refs } = hydratePlayerPhotos(localPhotos);
            setPlayerPhotos(urls);
            setPlayerPhotoRefs(refs);
            setTournamentTemplates(
              localTemplates.map(template => ({
                ...template,
                tournamentFormat: normalizeTournamentFormat(template.tournamentFormat || 'league'),
                teams: normalizeTemplateTeams(
                  template.teams || [],
                  template.gameMode || 'doubles',
                  template.numTeams || 3
                ),
              }))
            );
            setPlayerDatabase(localPlayers);
            setPlayerRatings(localRatings);
            setTournamentHistory(localHistory);
            setCasualMatches(localCasualMatches);
          }
    
          return;
        }
    
        // 3️⃣ APPWRITE MODE
        const appwriteData = await loadFromAppwrite();
    
        if (mounted && appwriteData) {
          setTournamentHistory(appwriteData.tournaments || []);
          setPlayerDatabase(appwriteData.playerDatabase || []);
          setPlayerRatings(appwriteData.playerRatings || {});
          setMembers(appwriteData.members?.length ? appwriteData.members : localMembers);
          const sourcePhotos = Object.keys(appwriteData.playerPhotos || {}).length ? appwriteData.playerPhotos : localPhotos;
          const { urls, refs } = hydratePlayerPhotos(sourcePhotos);
          setPlayerPhotos(urls);
          setPlayerPhotoRefs(refs);
          const sourceTemplates = appwriteData.templates?.length ? appwriteData.templates : localTemplates;
          setTournamentTemplates(
            sourceTemplates.map(template => ({
              ...template,
              tournamentFormat: normalizeTournamentFormat(template.tournamentFormat || 'league'),
              teams: normalizeTemplateTeams(
                template.teams || [],
                template.gameMode || 'doubles',
                template.numTeams || 3
              ),
            }))
          );
        }
    
        const matches = await casualMatchService.getAllCasualMatches();
        if (mounted) setCasualMatches(matches || []);
    
      } catch (error) {
        console.error("Error loading:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    loadInitialData();
  
    return () => {
      mounted = false;
    };
  }, [isAppwriteEnabled, isConfigChecked]); // Load after Appwrite config is resolved

  // Auto-save player ratings to Appwrite
  useEffect(() => {
    if (Object.keys(playerRatings).length > 0) {
      if (isAppwriteEnabled) {
        saveRatingsToAppwrite(playerRatings);
      } else {
        localStorage.setItem("badminton_ratings", JSON.stringify(playerRatings));
      }
    }
    
  }, [playerRatings, isAppwriteEnabled]);

  // Auto-sync current tournament state to Appwrite and save session
// Auto-save session state (debounced)
useEffect(() => {
  if (step !== 'setup' && tournamentName) {
    const timer = setTimeout(() => {
      saveSessionState({
        step,
        tournamentName,
        numTeams,
        format,
        gameMode,
        tournamentFormat,
        teams,
        fixtures,
        bracket,
        champion,
        aiMatchSummaries,
        currentTournamentId,
      });
    }, 500); // ✅ Debounce 500ms

    return () => clearTimeout(timer);
  }
}, [step, tournamentName, numTeams, format, gameMode,
    tournamentFormat, teams, fixtures, bracket,
    champion, aiMatchSummaries, currentTournamentId, saveSessionState]);

  const teamNameDatabase = useMemo(() => {
    const names = tournamentHistory
      .flatMap(tournament => tournament?.teams || [])
      .map(team => team?.name?.trim())
      .filter(Boolean);

    return [...new Set(names)];
  }, [tournamentHistory]);

  const pairingAnalytics = useMemo(() => buildPairingAnalytics({
    tournamentHistory,
    casualMatches,
    playerRatings,
  }), [tournamentHistory, casualMatches, playerRatings]);
  const formPowerRankings = useMemo(() => buildFormPowerRankings(playerRatings), [playerRatings]);

  const captureUndoSnapshot = () => {
    const snapshot = {
      step,
      tournamentName,
      numTeams,
      format,
      gameMode,
      tournamentFormat,
      teams: JSON.parse(JSON.stringify(teams)),
      fixtures: JSON.parse(JSON.stringify(fixtures)),
      bracket: JSON.parse(JSON.stringify(bracket)),
      champion: champion ? JSON.parse(JSON.stringify(champion)) : null,
      aiMatchSummaries: JSON.parse(JSON.stringify(aiMatchSummaries)),
      playerRatings: JSON.parse(JSON.stringify(playerRatings)),
      tournamentHistory: JSON.parse(JSON.stringify(tournamentHistory)),
      casualMatches: JSON.parse(JSON.stringify(casualMatches)),
      currentTournamentId,
    };

    setUndoStack(prev => [...prev.slice(-19), snapshot]);
  };

  const undoLastAction = async () => {
    const lastSnapshot = undoStack[undoStack.length - 1];
    if (!lastSnapshot) {
      showToast('Nothing to undo', 'error');
      return;
    }

    setUndoStack(prev => prev.slice(0, -1));
    setStep(lastSnapshot.step);
    setTournamentName(lastSnapshot.tournamentName);
    setNumTeams(lastSnapshot.numTeams);
    setFormat(lastSnapshot.format);
    setGameMode(lastSnapshot.gameMode);
    setTournamentFormat(lastSnapshot.tournamentFormat);
    setTeams(lastSnapshot.teams);
    setFixtures(lastSnapshot.fixtures);
    setBracket(lastSnapshot.bracket);
    setChampion(lastSnapshot.champion);
    setAiMatchSummaries(lastSnapshot.aiMatchSummaries || []);
    setPlayerRatings(lastSnapshot.playerRatings);
    setTournamentHistory(lastSnapshot.tournamentHistory);
    setCasualMatches(lastSnapshot.casualMatches);
    setCurrentTournamentId(lastSnapshot.currentTournamentId);

    if (isAppwriteEnabled) {
      await saveRatingsToAppwrite(lastSnapshot.playerRatings);
    } else {
      localStorage.setItem("badminton_ratings", JSON.stringify(lastSnapshot.playerRatings));
      localStorage.setItem("badminton_history", JSON.stringify(lastSnapshot.tournamentHistory));
      localStorage.setItem("badminton_casual_matches", JSON.stringify(lastSnapshot.casualMatches));
    }

    showToast('Undid last action');
  };

  // Initialize teams
  useEffect(() => {
    if (step === 'teams') {
      const newTeams = Array.isArray(pendingPrefilledTeams) && pendingPrefilledTeams.length === numTeams
        ? pendingPrefilledTeams.map((team, i) => ({
            id: i + 1,
            emoji: team.emoji || '🏸',
            name: team.name || '',
            player1: team.player1 || team.player || '',
            player: team.player1 || team.player || '',
            player2: gameMode === 'singles' ? '' : (team.player2 || ''),
          }))
        : Array.from({ length: numTeams }, (_, i) => ({
            id: i + 1,
            emoji: '🏸',
            name: '',
            player1: '',
            player2: '',
          }));
      setTeams(newTeams);
      setPendingPrefilledTeams(null);
    }
  }, [step, numTeams, gameMode, pendingPrefilledTeams]);

  const updatePlayerDatabase = (playerName) => {
    if (!playerName || playerName.trim() === "") return;
  
    setPlayerDatabase(prev => {
      if (prev.includes(playerName.trim())) return prev;
  
      const updated = [...prev, playerName.trim()];
  
      if (isAppwriteEnabled) {
        savePlayerDatabaseToAppwrite(updated);
      } else {
        localStorage.setItem("badminton_players", JSON.stringify(updated));
      }
  
      return updated;
    });
  };

  const saveMembersToLocal = (updatedMembers) => {
    if (isAppwriteEnabled) {
      saveMembersToAppwrite(updatedMembers).catch((error) => {
        console.error('Failed to save members to Appwrite:', error);
      });
      return;
    }
    localStorage.setItem("badminton_members", JSON.stringify(updatedMembers));
  };

  const saveTemplatesToLocal = (updatedTemplates) => {
    if (isAppwriteEnabled) {
      saveTemplatesToAppwrite(updatedTemplates).catch((error) => {
        console.error('Failed to save templates to Appwrite:', error);
      });
      return;
    }
    localStorage.setItem("badminton_templates", JSON.stringify(updatedTemplates));
  };

  const addMember = (memberData) => {
    const name = memberData?.name?.trim();
    const phone = memberData?.phone?.trim();
    if (!name || !phone) return { success: false, reason: 'Name and phone are required' };

    let memberAdded = null;
    setMembers(prev => {
      const existing = prev.find(m => m.name.toLowerCase() === name.toLowerCase());
      const normalizedMember = {
        id: existing?.id || `member-${Date.now()}`,
        name,
        phone,
      };
      const updated = existing
        ? prev.map(m => (m.id === existing.id ? normalizedMember : m))
        : [...prev, normalizedMember];

      saveMembersToLocal(updated);
      memberAdded = existing ? { ...normalizedMember, updated: true } : normalizedMember;
      return updated;
    });

    updatePlayerDatabase(name);
    return { success: true, member: memberAdded };
  };

  const deleteMember = (memberId) => {
    setMembers(prev => {
      const updated = prev.filter(member => member.id !== memberId);
      saveMembersToLocal(updated);
      return updated;
    });
  };

  const updatePlayerPhoto = async (playerName, photoInput) => {
    const name = playerName?.trim();
    if (!name) return { success: false };

    const normalized = normalizePhotoInput(photoInput);
    const existingRef = playerPhotoRefs[name];

    try {
      if (isAppwriteEnabled && playerPhotoStorageService.isStorageEnabled()) {
        if (!normalized) {
          if (existingRef?.fileId) {
            await playerPhotoStorageService.deletePhoto(existingRef.fileId);
          }

          const updatedRefs = { ...playerPhotoRefs };
          delete updatedRefs[name];
          const updatedUrls = { ...playerPhotos };
          delete updatedUrls[name];

          setPlayerPhotoRefs(updatedRefs);
          setPlayerPhotos(updatedUrls);
          await savePlayerPhotosToAppwrite(updatedRefs);
          return { success: true };
        }

        if (/^data:image\//i.test(normalized)) {
          const uploaded = await playerPhotoStorageService.uploadPhoto({
            playerName: name,
            dataUrl: normalized,
          });

          if (existingRef?.fileId) {
            await playerPhotoStorageService.deletePhoto(existingRef.fileId);
          }

          const updatedRefs = {
            ...playerPhotoRefs,
            [name]: {
              fileId: uploaded.fileId,
              type: 'storage',
              updatedAt: new Date().toISOString(),
            },
          };
          const updatedUrls = {
            ...playerPhotos,
            [name]: uploaded.url,
          };
          setPlayerPhotoRefs(updatedRefs);
          setPlayerPhotos(updatedUrls);
          await savePlayerPhotosToAppwrite(updatedRefs);
          return { success: true };
        }
      }

      setPlayerPhotos(prev => {
        const updated = { ...prev };
        if (normalized) updated[name] = normalized;
        else delete updated[name];
        if (isAppwriteEnabled) {
          savePlayerPhotosToAppwrite(updated).catch((saveError) => {
            console.error('Failed to save player photos to Appwrite:', saveError);
            localStorage.setItem('badminton_player_photos', JSON.stringify(updated));
          });
        } else {
          localStorage.setItem('badminton_player_photos', JSON.stringify(updated));
        }
        return updated;
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to update player photo:', error);
      return { success: false, error };
    }

  };

  const saveTournamentTemplate = (templateData) => {
    const name = templateData?.name?.trim();
    if (!name) {
      showToast('Template name is required', 'error');
      return { success: false };
    }

    const templateFormat = normalizeTournamentFormat(templateData.tournamentFormat || tournamentFormat);
    const templateGameMode = templateData.gameMode || gameMode;
    const templateNumTeams = Math.max(3, parseInt(templateData.numTeams, 10) || numTeams || 3);
    const normalizedTeams = normalizeTemplateTeams(
      templateData.teams || [],
      templateGameMode,
      templateNumTeams
    );

    const normalizedTemplate = {
      id: templateData.id || `template-${Date.now()}`,
      name,
      gameMode: templateGameMode,
      tournamentFormat: templateFormat,
      format: templateData.format || format,
      numTeams: templateNumTeams,
      teams: normalizedTeams,
      createdAt: new Date().toISOString(),
    };

    setTournamentTemplates(prev => {
      const existingIndex = prev.findIndex(
        t => t.id === normalizedTemplate.id || t.name.toLowerCase() === name.toLowerCase()
      );
      const updated = existingIndex >= 0
        ? prev.map((template, index) =>
            index === existingIndex ? { ...normalizedTemplate, id: template.id } : template
          )
        : [normalizedTemplate, ...prev];

      saveTemplatesToLocal(updated);
      return updated;
    });

    showToast('Template saved');
    return { success: true };
  };

  const applyTournamentTemplate = (templateId) => {
    const template = tournamentTemplates.find(t => t.id === templateId);
    if (!template) return;

    const appliedFormat = normalizeTournamentFormat(template.tournamentFormat || 'league');
    const appliedMode = template.gameMode || 'doubles';
    const appliedNumTeams = Math.max(3, parseInt(template.numTeams, 10) || 3);
    const normalizedTeams = normalizeTemplateTeams(template.teams || [], appliedMode, appliedNumTeams);

    setGameMode(appliedMode);
    setTournamentFormat(appliedFormat);
    setFormat(template.format || '1');

    if (appliedFormat === 'semiFinal') {
      setNumTeams(4);
    } else if (appliedFormat === 'fullKnockout') {
      setNumTeams(8);
    } else {
      setNumTeams(appliedNumTeams);
    }
    setPendingPrefilledTeams(normalizedTeams);

    showToast(`Template "${template.name}" applied`);

    if (!window.confirm('Template applied. Generate fixtures and start tournament now?')) {
      return;
    }

    const hasCompleteTeams = normalizedTeams.every(team => {
      if (!team.name?.trim()) return false;
      if (!team.player1?.trim()) return false;
      if (appliedMode !== 'singles' && !team.player2?.trim()) return false;
      return true;
    });

    if (!hasCompleteTeams) {
      showToast('Template teams are incomplete. Please review team details first.', 'error');
      setStep('teams');
      return;
    }

    const autoTournamentName = tournamentName.trim() ? tournamentName : `${template.name} Tournament`;
    if (!tournamentName.trim()) {
      setTournamentName(autoTournamentName);
    }
    setTeams(normalizedTeams);
    setPendingPrefilledTeams(null);
    generateFixtures({
      teamsOverride: normalizedTeams,
      tournamentFormatOverride: appliedFormat,
      formatOverride: template.format || '1',
      gameModeOverride: appliedMode,
      tournamentNameOverride: autoTournamentName
    });
  };

  const deleteTournamentTemplate = (templateId) => {
    setTournamentTemplates(prev => {
      const updated = prev.filter(template => template.id !== templateId);
      saveTemplatesToLocal(updated);
      return updated;
    });
    showToast('Template deleted');
  };

  const handleStartTournament = (rawNumTeamsInput) => {
    if (!tournamentName.trim()) {
      showToast('Please enter tournament name', 'error');
      return;
    }

    if (tournamentFormat === 'league') {
      const parsedNumTeams = parseInt(rawNumTeamsInput, 10);
      if (Number.isNaN(parsedNumTeams)) {
        showToast('Please enter number of teams', 'error');
        return;
      }
      if (parsedNumTeams < 3 || parsedNumTeams > 12) {
        showToast('Number of teams must be between 3 and 12', 'error');
        return;
      }
      setNumTeams(parsedNumTeams);
    }

    if (tournamentFormat === 'knockoutByes') {
      const parsedNumTeams = parseInt(rawNumTeamsInput, 10);
      if (Number.isNaN(parsedNumTeams)) {
        showToast('Please enter number of teams', 'error');
        return;
      }
      if (parsedNumTeams < 3 || parsedNumTeams > 16) {
        showToast('Number of teams must be between 3 and 16', 'error');
        return;
      }
      setNumTeams(parsedNumTeams);
    }

    if (tournamentFormat === 'semiFinal') {
      setNumTeams(4);
    } else if (tournamentFormat === 'fullKnockout') {
      setNumTeams(8);
    }

    setStep('teams');
  };

  const generateFixtures = ({
    teamsOverride,
    tournamentFormatOverride,
    formatOverride,
    gameModeOverride,
    tournamentNameOverride
  } = {}) => {
    const selectedTeams = teamsOverride || teams;
    const selectedTournamentFormat = tournamentFormatOverride || tournamentFormat;
    const selectedFormat = formatOverride || format;
    const selectedGameMode = gameModeOverride || gameMode;
    const selectedTournamentName = tournamentNameOverride || tournamentName;

    setLoading(true);
    setLastTournamentConfig({
      name: selectedTournamentName,
      numTeams: selectedTeams.length || numTeams,
      format: selectedFormat,
      teams: selectedTeams,
      gameMode: selectedGameMode,
      tournamentFormat: selectedTournamentFormat
    });
    
    const updatedRatings = { ...playerRatings };
    selectedTeams.forEach(team => {
      const player1 = team.player || team.player1;
      const player2 = team.player2;
      
      updatePlayerDatabase(player1);
      if (player2) updatePlayerDatabase(player2);
      
      if (player1 && !updatedRatings[player1]) {
        updatedRatings[player1] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
      if (player2 && !updatedRatings[player2]) {
        updatedRatings[player2] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
    });
    setPlayerRatings(updatedRatings);

    setTimeout(async () => {
      let newFixtures = [];
      let newBracket = [];

      if (selectedTournamentFormat === 'league') {
        newFixtures = createFixtures(selectedTeams, selectedFormat);
        setFixtures(newFixtures);
      } else {
        newBracket = generateKnockoutBracket(selectedTeams, selectedTournamentFormat);
        setBracket(newBracket);
      }
      setAiMatchSummaries([]);

      // Save tournament to Appwrite
      if (isAppwriteEnabled) {
        const tournamentData = {
          name: selectedTournamentName,
          date: new Date().toLocaleDateString(),
          teams: selectedTeams,
          fixtures: newFixtures,
          bracket: newBracket.length > 0 ? newBracket : null,
          format: selectedFormat,
          gameMode: selectedGameMode,
          tournamentFormat: selectedTournamentFormat,
          aiSummaries: [],
          status: 'active',
        };

        const saved = await saveTournamentToAppwrite(tournamentData);
        if (saved) {
          setCurrentTournamentId(saved.id);
        }
      }

      setStep('tournament');
      setLoading(false);
      showToast('Tournament generated! 🏸');
    }, 800);
  };

  const upsertTournamentHistory = (history, tournament) => {
    const tournamentKey = tournament.appwriteId || tournament.id;
    const existingIndex = history.findIndex(t => (t.appwriteId || t.id) === tournamentKey);
    return existingIndex >= 0
      ? history.map((t, index) => (index === existingIndex ? tournament : t))
      : [tournament, ...history];
  };

  const getPlayersFromMatch = (match) => {
    if (!match?.team1 || !match?.team2) return [];
    const players = [
      match.team1.player || match.team1.player1,
      match.team1.player2,
      match.team2.player || match.team2.player1,
      match.team2.player2,
    ].filter(Boolean);
    return [...new Set(players)];
  };

  const getBadgeUnlocksForMatch = ({
    match,
    ratingsBefore,
    ratingsAfter,
    historyBefore = tournamentHistory,
    historyAfter = tournamentHistory,
  }) => {
    const players = getPlayersFromMatch(match);
    return players.flatMap((playerName) => {
      const before = buildPlayerAchievements({
        playerName,
        playerRatings: ratingsBefore,
        tournamentHistory: historyBefore,
        casualMatches,
      });
      const after = buildPlayerAchievements({
        playerName,
        playerRatings: ratingsAfter,
        tournamentHistory: historyAfter,
        casualMatches,
      });
      return detectNewlyUnlockedBadges(before.badges, after.badges).map(badge => ({
        player: playerName,
        ...badge,
      }));
    });
  };

  const pushAiSummary = (summary) => {
    if (!summary) return aiMatchSummaries;
    const updated = [summary, ...aiMatchSummaries].slice(0, 50);
    setAiMatchSummaries(updated);
    return updated;
  };

  const saveMatchResult = (matchId, score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return;
    }
    captureUndoSnapshot();

    const match = fixtures.find(m => m.id === matchId);
    const prediction = predictMatchOutcome({
      match,
      playerRatings,
      tournamentHistory,
      casualMatches,
    });
    const upsetAlert = getUpsetAlert({
      prediction,
      score1,
      score2,
      team1Name: match?.team1?.name,
      team2Name: match?.team2?.name,
    });
    const completedMatch = {
      ...match,
      score1: parseInt(score1),
      score2: parseInt(score2),
      completed: true,
      upsetAlert,
      preMatchPrediction: prediction,
    };

    const ratingsBefore = playerRatings;
    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, completedMatch);
    const updatedFixtures = fixtures.map(m => m.id === matchId ? completedMatch : m);
    const updatedPointsTable = calculatePointsTable(teams, updatedFixtures);
    const badgeUnlocks = getBadgeUnlocksForMatch({
      match: completedMatch,
      ratingsBefore,
      ratingsAfter: updatedRatings,
    });

    setPlayerRatings(updatedRatings);
    setFixtures(updatedFixtures);
    const nextSummaries = pushAiSummary(buildAiMatchSummary({
      match: completedMatch,
      tournamentName,
      tournamentFormat,
      prediction,
      upsetAlert,
      pointsTable: updatedPointsTable,
      badgeUnlocks,
      isFinal: false,
    }));

    if (isAppwriteEnabled && currentTournamentId) {
      syncCurrentTournament({
        fixtures: updatedFixtures,
        bracket,
        champion,
        finalMatch: null,
        aiSummaries: nextSummaries,
      });
    }
    
    showToast('Result saved! ✓');
  };

  const prioritizeMatch = (matchId) => {
    const currentIndex = fixtures.findIndex(match => !match.completed);
    const targetIndex = fixtures.findIndex(match => match.id === matchId && !match.completed);

    if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) {
      return;
    }

    captureUndoSnapshot();
    const reordered = [...fixtures];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    setFixtures(reordered);
    if (isAppwriteEnabled && currentTournamentId) {
      syncCurrentTournament({
        fixtures: reordered,
        bracket,
        champion,
        finalMatch: null,
        aiSummaries: aiMatchSummaries,
      });
    }
    showToast('Match moved to LIVE NOW');
  };

  const saveBracketMatchResult = async (matchId, score1, score2) => {
    captureUndoSnapshot();
    const sourceMatch = bracket.flat().find(m => m.id === matchId);
    const prediction = predictMatchOutcome({
      match: sourceMatch,
      playerRatings,
      tournamentHistory,
      casualMatches,
    });
    const upsetAlert = getUpsetAlert({
      prediction,
      score1,
      score2,
      team1Name: sourceMatch?.team1?.name,
      team2Name: sourceMatch?.team2?.name,
    });

    const rawBracket = updateBracket(bracket, matchId, score1, score2);
    const updatedBracket = rawBracket.map(round => round.map((match) => (
      match.id === matchId
        ? { ...match, upsetAlert, preMatchPrediction: prediction }
        : match
    )));
    setBracket(updatedBracket);
    let nextSummaries = aiMatchSummaries;
    
    let match = null;
    for (const round of updatedBracket) {
      match = round.find(m => m.id === matchId);
      if (match) break;
    }
    
    if (match && match.completed) {
      const ratingsBefore = playerRatings;
      const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, match);
      setPlayerRatings(updatedRatings);
      const finalRound = updatedBracket[updatedBracket.length - 1];
      const finalMatch = finalRound[0];
      const isFinalMatch = finalMatch?.id === match.id;

      if (!isFinalMatch) {
        const badgeUnlocks = getBadgeUnlocksForMatch({
          match,
          ratingsBefore,
          ratingsAfter: updatedRatings,
        });
        const midSummary = buildAiMatchSummary({
          match,
          tournamentName,
          tournamentFormat,
          prediction,
          upsetAlert,
          pointsTable: [],
          badgeUnlocks,
          isFinal: false,
        });
        if (midSummary) {
          nextSummaries = [midSummary, ...nextSummaries].slice(0, 50);
        }
      }
      
      if (finalMatch.completed) {
        const winner = finalMatch.score1 > finalMatch.score2 ? finalMatch.team1 : finalMatch.team2;
        setChampion(winner);
        const tournamentId = currentTournamentId || Date.now();
        setCurrentTournamentId(tournamentId);
        
        const tournament = {
          id: tournamentId,
          appwriteId: currentTournamentId,
          name: tournamentName,
          date: new Date().toLocaleDateString(),
          teams,
          bracket: updatedBracket,
          champion: winner,
          format: tournamentFormat,
          gameMode
        };
        const historyAfter = upsertTournamentHistory(tournamentHistory, tournament);
        const finalBadgeUnlocks = getBadgeUnlocksForMatch({
          match: finalMatch,
          ratingsBefore,
          ratingsAfter: updatedRatings,
          historyBefore: tournamentHistory,
          historyAfter,
        });
        const finalSummary = buildAiMatchSummary({
          match: finalMatch,
          tournamentName,
          tournamentFormat,
          prediction: finalMatch.preMatchPrediction,
          upsetAlert: finalMatch.upsetAlert,
          pointsTable: [],
          badgeUnlocks: finalBadgeUnlocks,
          isFinal: true,
        });
        if (finalSummary) {
          nextSummaries = [finalSummary, ...nextSummaries].slice(0, 50);
        }
        setAiMatchSummaries(nextSummaries);
        tournament.aiSummaries = nextSummaries;
        await saveTournamentHistory(tournament);
      } else {
        setAiMatchSummaries(nextSummaries);
        if (isAppwriteEnabled && currentTournamentId) {
          syncCurrentTournament({
            fixtures,
            bracket: updatedBracket,
            champion: null,
            finalMatch: null,
            aiSummaries: nextSummaries,
          });
        }
      }
    }
    
    showToast('Result saved! ✓');
  };

  const saveFinalResult = async (score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return;
    }
    captureUndoSnapshot();

    const pointsTable = calculatePointsTable(teams, fixtures);
    const finalists = [pointsTable[0], pointsTable[1]];
    const prediction = predictMatchOutcome({
      match: { team1: finalists[0], team2: finalists[1] },
      playerRatings,
      tournamentHistory,
      casualMatches,
    });
    const upsetAlert = getUpsetAlert({
      prediction,
      score1,
      score2,
      team1Name: finalists[0]?.name,
      team2Name: finalists[1]?.name,
    });
    const winner = score1 > score2 ? finalists[0] : finalists[1];
    
    const finalMatch = {
      id: 'final',
      team1: finalists[0],
      team2: finalists[1],
      score1: parseInt(score1),
      score2: parseInt(score2),
      completed: true,
      upsetAlert,
      preMatchPrediction: prediction,
    };

    const ratingsBefore = playerRatings;
    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, finalMatch);
    setPlayerRatings(updatedRatings);
    setChampion(winner);
    const tournamentId = currentTournamentId || Date.now();
    setCurrentTournamentId(tournamentId);

    const tournament = {
      id: tournamentId,
      appwriteId: currentTournamentId,
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams,
      fixtures,
      finalMatch,
      champion: winner,
      format,
      gameMode
    };
    const historyAfter = upsertTournamentHistory(tournamentHistory, tournament);
    const badgeUnlocks = getBadgeUnlocksForMatch({
      match: finalMatch,
      ratingsBefore,
      ratingsAfter: updatedRatings,
      historyBefore: tournamentHistory,
      historyAfter,
    });
    const nextSummaries = pushAiSummary(buildAiMatchSummary({
      match: finalMatch,
      tournamentName,
      tournamentFormat,
      prediction,
      upsetAlert,
      pointsTable,
      badgeUnlocks,
      isFinal: true,
    }));
    tournament.aiSummaries = nextSummaries;
    await saveTournamentHistory(tournament);
    showToast(`🎉 ${winner.name} are the champions!`);
  };

  const saveTournamentHistory = async (tournament) => {
    const updatedHistory = upsertTournamentHistory(tournamentHistory, tournament);
    setTournamentHistory(updatedHistory);
  
    if (isAppwriteEnabled && tournament.appwriteId) {
      await saveTournamentToAppwrite({
        ...tournament,
        status: 'completed',
      });
    } else {
      localStorage.setItem("badminton_history", JSON.stringify(updatedHistory));
    }
    return updatedHistory;
  };
  

  const saveCasualMatch = async (matchData) => {
    try {
      captureUndoSnapshot();
      // Determine winner
      const winner = matchData.score1 > matchData.score2 ? 'team1' : 'team2';
      const matchWithWinner = { ...matchData, winner };

      // Update ELO ratings
      const match = {
        id: `casual-${Date.now()}`,
        team1: matchData.team1,
        team2: matchData.team2,
        score1: matchData.score1,
        score2: matchData.score2,
        completed: true,
      };

      const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, match);
      setPlayerRatings(updatedRatings);

      // Save ratings to Appwrite
      if (isAppwriteEnabled) {
        await saveRatingsToAppwrite(updatedRatings);
      }

      // Save match to Appwrite
      if (isAppwriteEnabled) {
        const savedMatch = await casualMatchService.createCasualMatch(matchWithWinner);
        setCasualMatches(prev => [savedMatch, ...prev]);
        console.log('✅ Casual match saved to Appwrite');
      } else {
        const localMatch = {
          ...matchWithWinner,
          id: `casual-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        setCasualMatches(prev => {
          const updatedMatches = [localMatch, ...prev];
          localStorage.setItem("badminton_casual_matches", JSON.stringify(updatedMatches));
          return updatedMatches;
        });
      }

      showToast('✅ Match recorded & ELO updated!');
      setShowCasualMatch(false);
    } catch (error) {
      console.error('Error saving casual match:', error);
      showToast('Failed to save match', 'error');
    }
  };

  const resetTournament = async () => {
    if (!window.confirm('Delete this tournament and start new? This will remove its impact from ELO/stats.')) return;

    try {
      captureUndoSnapshot();
      const updatedHistory = tournamentHistory.filter(t => {
        if (!currentTournamentId) return true;
        return t.id !== currentTournamentId && t.appwriteId !== currentTournamentId;
      });

      if (isAppwriteEnabled && currentTournamentId) {
        await deleteTournamentFromAppwrite(currentTournamentId);
      }

      setTournamentHistory(updatedHistory);

      const recalculatedRatings = recalculateEloFromHistory(updatedHistory, casualMatches);
      setPlayerRatings(recalculatedRatings);

      if (isAppwriteEnabled) {
        await saveRatingsToAppwrite(recalculatedRatings);
      } else {
        localStorage.setItem("badminton_history", JSON.stringify(updatedHistory));
      }

      clearSessionState();
      setStep('setup');
      setTournamentName('');
      setNumTeams(3);
      setTeams([]);
      setFixtures([]);
      setBracket([]);
      setChampion(null);
      setAiMatchSummaries([]);
      setCurrentTournamentId(null);
      showToast('Tournament deleted. ELO/stats recalculated.');
    } catch (error) {
      console.error('Error deleting current tournament:', error);
      showToast('Failed to delete current tournament', 'error');
    }
  };

  const rerunTournament = () => {
    setFixtures([]);
    setBracket([]);
    setChampion(null);
    setAiMatchSummaries([]);
    setCurrentTournamentId(null);
    
    setTimeout(() => {
      if (tournamentFormat === 'league') {
        const newFixtures = createFixtures(teams, format);
        setFixtures(newFixtures);
      } else {
        const newBracket = generateKnockoutBracket(teams, tournamentFormat);
        setBracket(newBracket);
      }
      showToast('Rematch started! 🏸');
    }, 500);
  };

  const goHome = () => {
    clearSessionState();
    setStep('setup');
    setTournamentName('');
    setNumTeams(3);
    setTeams([]);
    setFixtures([]);
    setBracket([]);
    setChampion(null);
    setAiMatchSummaries([]);
    setCurrentTournamentId(null);
  };

  const recalculateEloFromHistory = (history, casualMatchHistory = []) => {
    let ratings = {};
    const tournamentHistoryList = Array.isArray(history) ? history : [];
    const sortedHistory = [...tournamentHistoryList].sort((a, b) => (a.id || 0) - (b.id || 0));
    
    sortedHistory.forEach(tournament => {
      if (!tournament) return;
      
      const teams = tournament.teams || [];
      teams.forEach(team => {
        if (!team) return;
        const players = [team.player || team.player1, team.player2].filter(Boolean);
        players.forEach(player => {
          if (player && !ratings[player]) {
            ratings[player] = { rating: 1000, matchesPlayed: 0, history: [] };
          }
        });
      });

      const allMatches = [
        ...(Array.isArray(tournament.fixtures) ? tournament.fixtures : []),
        ...(tournament.finalMatch ? [tournament.finalMatch] : [])
      ];

      if (Array.isArray(tournament.bracket)) {
        tournament.bracket.forEach(round => {
          if (Array.isArray(round)) {
            round.forEach(match => {
              if (match && match.completed) allMatches.push(match);
            });
          }
        });
      }

      allMatches.forEach(match => {
        if (match && match.completed && match.team1 && match.team2) {
          try {
            ratings = updatePlayerRatingsAfterMatchStatic(ratings, match);
          } catch (error) {
            console.error('Error updating ratings for match:', error);
          }
        }
      });
    });

    casualMatchHistory.forEach(match => {
      if (!match || !match.team1 || !match.team2) return;
      const normalizedMatch = {
        ...match,
        score1: Number(match.score1),
        score2: Number(match.score2),
        completed: true,
      };

      if (Number.isNaN(normalizedMatch.score1) || Number.isNaN(normalizedMatch.score2)) return;
      ratings = updatePlayerRatingsAfterMatchStatic(ratings, normalizedMatch);
    });

    return ratings;
  };

  const updatePlayerRatingsAfterMatchStatic = (currentRatings, match) => {
    if (!match || !match.team1 || !match.team2) return currentRatings;
    
    const updatedRatings = { ...currentRatings };
    const team1Players = [match.team1.player || match.team1.player1, match.team1.player2].filter(Boolean);
    const team2Players = [match.team2.player || match.team2.player1, match.team2.player2].filter(Boolean);
    
    if (team1Players.length === 0 || team2Players.length === 0) return currentRatings;
    
    [...team1Players, ...team2Players].forEach(player => {
      if (player && !updatedRatings[player]) {
        updatedRatings[player] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
    });

    const team1AvgRating = team1Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || 1000), 0) / team1Players.length;
    const team2AvgRating = team2Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || 1000), 0) / team2Players.length;
    
    const team1Score = match.score1 > match.score2 ? 1 : 0;
    const team2Score = match.score2 > match.score1 ? 1 : 0;
    
    team1Players.forEach(player => {
      if (!player || !updatedRatings[player]) return;
      const oldRating = updatedRatings[player].rating;
      const expectedScore = 1 / (1 + Math.pow(10, (team2AvgRating - oldRating) / 400));
      const newRating = Math.round(oldRating + 32 * (team1Score - expectedScore));
      const change = newRating - oldRating;
      
      updatedRatings[player] = {
        rating: newRating,
        matchesPlayed: (updatedRatings[player].matchesPlayed || 0) + 1,
        history: [
          ...(updatedRatings[player].history || []),
          { matchId: match.id, oldRating, newRating, change, opponent: team2Players.join(' & '), result: team1Score === 1 ? 'win' : 'loss', date: new Date().toISOString() }
        ]
      };
    });
    
    team2Players.forEach(player => {
      if (!player || !updatedRatings[player]) return;
      const oldRating = updatedRatings[player].rating;
      const expectedScore = 1 / (1 + Math.pow(10, (team1AvgRating - oldRating) / 400));
      const newRating = Math.round(oldRating + 32 * (team2Score - expectedScore));
      const change = newRating - oldRating;
      
      updatedRatings[player] = {
        rating: newRating,
        matchesPlayed: (updatedRatings[player].matchesPlayed || 0) + 1,
        history: [
          ...(updatedRatings[player].history || []),
          { matchId: match.id, oldRating, newRating, change, opponent: team1Players.join(' & '), result: team2Score === 1 ? 'win' : 'loss', date: new Date().toISOString() }
        ]
      };
    });

    return updatedRatings;
  };

  return (
    <>
      {step === 'setup' && (
        <SetupScreen
          tournamentName={tournamentName}
          setTournamentName={setTournamentName}
          numTeams={numTeams}
          setNumTeams={setNumTeams}
          format={format}
          setFormat={setFormat}
          gameMode={gameMode}
          setGameMode={setGameMode}
          tournamentFormat={tournamentFormat}
          setTournamentFormat={setTournamentFormat}
          onNext={handleStartTournament}
          onRecordCasualMatch={() => setShowCasualMatch(true)}
          lastTournamentConfig={lastTournamentConfig}
          onReuseTournament={() => {
            if (lastTournamentConfig) {
              setTournamentName(lastTournamentConfig.name + ' (Rematch)');
              setNumTeams(lastTournamentConfig.numTeams);
              setFormat(lastTournamentConfig.format);
              setGameMode(lastTournamentConfig.gameMode || 'doubles');
              setTournamentFormat(normalizeTournamentFormat(lastTournamentConfig.tournamentFormat || 'league'));
              setPendingPrefilledTeams(lastTournamentConfig.teams.map((team, i) => ({ ...team, id: i + 1 })));
              setStep('teams');
              showToast('Tournament loaded!');
            }
          }}
          tournamentHistory={tournamentHistory}
          casualMatches={casualMatches}
          playerDatabase={playerDatabase}
          teamNameDatabase={teamNameDatabase}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          members={members}
          onAddMember={addMember}
          onDeleteMember={deleteMember}
          showCasualHistory={showCasualHistory}
          setShowCasualHistory={setShowCasualHistory}
          showAllTimeStats={showAllTimeStats}
          setShowAllTimeStats={setShowAllTimeStats}
          showEloLeaderboard={showEloLeaderboard}
          setShowEloLeaderboard={setShowEloLeaderboard}
          tournamentTemplates={tournamentTemplates}
          onSaveTemplate={saveTournamentTemplate}
          onApplyTemplate={applyTournamentTemplate}
          onDeleteTemplate={deleteTournamentTemplate}
          canUndo={undoStack.length > 0}
          onUndoLastAction={undoLastAction}
          onDeleteTournament={async (id) => {
            if (window.confirm('Delete this tournament?')) {
              captureUndoSnapshot();
              const tournament = tournamentHistory.find(t => t.id === id);
              
              // Delete from Appwrite if applicable
              if (isAppwriteEnabled && tournament?.appwriteId) {
                await deleteTournamentFromAppwrite(tournament.appwriteId);
              }

              const updatedHistory = tournamentHistory.filter(t => t.id !== id);
              setTournamentHistory(updatedHistory);
              
              const recalculatedRatings = recalculateEloFromHistory(updatedHistory, casualMatches);
              setPlayerRatings(recalculatedRatings);
              
              // Save updated ratings to Appwrite
              if (isAppwriteEnabled) {
                await saveRatingsToAppwrite(recalculatedRatings);
              } else {
                localStorage.setItem("badminton_history", JSON.stringify(updatedHistory));
              }
              
              showToast('Tournament deleted - ratings recalculated');
            }
          }}
          onDeleteCasualMatch={async (id) => {
            if (window.confirm('Delete this casual match?')) {
              try {
                captureUndoSnapshot();
                if (isAppwriteEnabled) {
                  await casualMatchService.deleteCasualMatch(id);
                }

                const updatedCasualMatches = casualMatches.filter(match => (match.id || match.appwriteId) !== id);
                setCasualMatches(updatedCasualMatches);

                if (!isAppwriteEnabled) {
                  localStorage.setItem("badminton_casual_matches", JSON.stringify(updatedCasualMatches));
                }

                const recalculatedRatings = recalculateEloFromHistory(tournamentHistory, updatedCasualMatches);
                setPlayerRatings(recalculatedRatings);

                if (isAppwriteEnabled) {
                  await saveRatingsToAppwrite(recalculatedRatings);
                }

                showToast('Casual match deleted - ratings recalculated');
              } catch (error) {
                console.error('Error deleting casual match:', error);
                showToast('Failed to delete casual match', 'error');
              }
            }
          }}
          allTimeStats={calculateCumulativePlayerStats(tournamentHistory)}
          eloLeaderboard={getPlayerLeaderboard(playerRatings)}
          playerRatings={playerRatings}
          pairingAnalytics={pairingAnalytics}
          formPowerRankings={formPowerRankings}
          playerPhotos={playerPhotos}
          onUpdatePlayerPhoto={updatePlayerPhoto}
          isAppwriteEnabled={isAppwriteEnabled}
          isSyncing={isSyncing}
        />
      )}

      {step === 'teams' && (
        <TeamEntry
          teams={teams}
          setTeams={setTeams}
          gameMode={gameMode}
          playerDatabase={playerDatabase}
          teamNameDatabase={teamNameDatabase}
          onGenerate={generateFixtures}
          loading={loading}
          onBack={() => setStep('setup')}
        />
      )}

      {step === 'tournament' && (
        <TournamentView
          tournamentName={tournamentName}
          setTournamentName={setTournamentName}
          format={format}
          tournamentFormat={tournamentFormat}
          fixtures={fixtures}
          bracket={bracket}
          teams={teams}
          champion={champion}
          members={members}
          playerRatings={playerRatings}
          gameMode={gameMode}
          tournamentHistory={tournamentHistory}
          casualMatches={casualMatches}
          aiMatchSummaries={aiMatchSummaries}
          playerPhotos={playerPhotos}
          onUpdatePlayerPhoto={updatePlayerPhoto}
          inviteList={getInvitablePlayers({
            teams,
            members,
            fixtures,
            bracket,
            format,
            tournamentFormat,
            tournamentName
          })}
          onSaveMatchResult={saveMatchResult}
          onPrioritizeMatch={prioritizeMatch}
          onSaveBracketResult={saveBracketMatchResult}
          onSaveFinalResult={saveFinalResult}
          canUndo={undoStack.length > 0}
          onUndoLastAction={undoLastAction}
          onGoHome={goHome}
          onResetTournament={resetTournament}
          onRerunTournament={rerunTournament}
          calculatePointsTable={calculatePointsTable}
          calculatePlayerStats={calculatePlayerStats}
          getPlayerLeaderboard={getPlayerLeaderboard}
        />
      )}

      {showCasualMatch && (
        <CasualMatch
          playerDatabase={playerDatabase}
          playerRatings={playerRatings}
          onSaveMatch={saveCasualMatch}
          onAddPlayer={updatePlayerDatabase}
          onClose={() => setShowCasualMatch(false)}
        />
      )}

      <Toast message={toast?.message} type={toast?.type} />
    </>
  );
};

export default App;
