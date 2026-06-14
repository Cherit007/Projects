import { useCallback } from 'react';
import { queueLocalStorageJson } from '../services/localStorageWriteService';
import { STORAGE_KEYS } from '../platform/storageKeys';
import { normalizeTemplateTeams, normalizeTournamentFormat } from '../utils/appHelpers';

export const useTemplateActions = ({
  isAppwriteEnabled = false,
  tournamentTemplates = [],
  setTournamentTemplates,
  tournamentFormat = 'league',
  gameMode = 'doubles',
  sportId = 'badminton',
  numTeams = 3,
  format = '1',
  tournamentName = '',
  setTournamentName,
  setGameMode,
  setTournamentFormat,
  setFormat,
  setNumTeams,
  setTeams,
  setPendingPrefilledTeams,
  setStep,
  assertCanOperate = () => true,
  assertCanDelete = () => true,
  showToast = () => {},
  saveTemplatesToCloud = async () => {},
  requestConfirmAction = async () => false,
  generateFixtures = () => {},
}) => {
  const persistTemplates = useCallback((updatedTemplates) => {
    if (isAppwriteEnabled) {
      saveTemplatesToCloud(updatedTemplates).catch((error) => {
        console.error('Failed to save templates to Appwrite:', error);
      });
      return;
    }
    queueLocalStorageJson(STORAGE_KEYS.TEMPLATES, updatedTemplates);
  }, [isAppwriteEnabled, saveTemplatesToCloud]);

  const saveTournamentTemplate = useCallback((templateData) => {
    if (!assertCanOperate()) return { success: false, reason: 'Read-only access' };
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
      sportId: templateData.sportId || sportId,
      gameMode: templateGameMode,
      tournamentFormat: templateFormat,
      format: templateData.format || format,
      numTeams: templateNumTeams,
      teams: normalizedTeams,
      createdAt: new Date().toISOString(),
    };

    setTournamentTemplates((prev) => {
      const existingIndex = prev.findIndex(
        (template) => template.id === normalizedTemplate.id
          || template.name.toLowerCase() === name.toLowerCase()
      );
      const updated = existingIndex >= 0
        ? prev.map((template, index) => (
          index === existingIndex ? { ...normalizedTemplate, id: template.id } : template
        ))
        : [normalizedTemplate, ...prev];

      persistTemplates(updated);
      return updated;
    });

    showToast('Template saved');
    return { success: true };
  }, [
    assertCanOperate,
    format,
    gameMode,
    numTeams,
    persistTemplates,
    setTournamentTemplates,
    showToast,
    tournamentFormat,
  ]);

  const applyTournamentTemplate = useCallback(async (templateId) => {
    if (!assertCanOperate()) return;
    const template = tournamentTemplates.find((item) => item.id === templateId);
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

    const shouldStartNow = await requestConfirmAction({
      title: 'Start Tournament Now?',
      message: 'Template applied. Generate fixtures and start tournament now?',
      confirmLabel: 'Generate & Start',
      cancelLabel: 'Not Now',
      tone: 'primary',
    });
    if (!shouldStartNow) {
      return;
    }

    const hasCompleteTeams = normalizedTeams.every((team) => {
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
    showToast(`Template "${template.name}" applied. Starting now...`);
    generateFixtures({
      teamsOverride: normalizedTeams,
      tournamentFormatOverride: appliedFormat,
      formatOverride: template.format || '1',
      gameModeOverride: appliedMode,
      tournamentNameOverride: autoTournamentName,
    });
  }, [
    assertCanOperate,
    generateFixtures,
    requestConfirmAction,
    setFormat,
    setGameMode,
    setNumTeams,
    setPendingPrefilledTeams,
    setStep,
    setTeams,
    setTournamentFormat,
    setTournamentName,
    showToast,
    tournamentName,
    tournamentTemplates,
  ]);

  const deleteTournamentTemplate = useCallback((templateId) => {
    if (!assertCanDelete()) return;
    setTournamentTemplates((prev) => {
      const updated = prev.filter((template) => template.id !== templateId);
      persistTemplates(updated);
      return updated;
    });
    showToast('Template deleted');
  }, [assertCanDelete, persistTemplates, setTournamentTemplates, showToast]);

  return {
    saveTournamentTemplate,
    applyTournamentTemplate,
    deleteTournamentTemplate,
  };
};
