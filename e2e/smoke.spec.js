import { test, expect } from '@playwright/test';
import { E2E_AUTH, installMockAppwrite } from './support/mockAppwrite';

const loginWithCredentials = async ({ page, email, password }) => {
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.locator('form button[type="submit"]').click();
};

const loginAsAdmin = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Badminton Dashboard/i })).toBeVisible();
  await loginWithCredentials({
    page,
    email: E2E_AUTH.admin.email,
    password: E2E_AUTH.admin.password,
  });
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
};

const logoutToAuthScreen = async (page) => {
  await page.getByRole('button', { name: /^Logout$/i }).first().click();
  await expect(page.getByRole('heading', { name: /Badminton Dashboard/i })).toBeVisible();
};

const TEAM_POOL = [
  { teamName: 'Falcons', players: ['Aarav', 'Bhanu'] },
  { teamName: 'Smash Kings', players: ['Chirag', 'Dev'] },
  { teamName: 'Net Ninjas', players: ['Eshan', 'Farhan'] },
  { teamName: 'Lions', players: ['Gaurav', 'Harsh'] },
  { teamName: 'Rockets', players: ['Ishan', 'Jai'] },
  { teamName: 'Titans', players: ['Karan', 'Laksh'] },
  { teamName: 'Warriors', players: ['Manav', 'Nikhil'] },
  { teamName: 'Cyclones', players: ['Om', 'Pranav'] },
  { teamName: 'Thunder', players: ['Rahul', 'Samar'] },
  { teamName: 'Blazers', players: ['Tanay', 'Uday'] },
];

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildTournamentTeams = (count = 3, startIndex = 0, gameMode = 'doubles') => (
  TEAM_POOL.slice(startIndex, startIndex + count).map((team) => ({
    teamName: team.teamName,
    players: gameMode === 'singles' ? [team.players[0]] : [...team.players],
  }))
);

const buildLeagueTeams = (count = 3, startIndex = 0) => buildTournamentTeams(count, startIndex, 'doubles');

const openTournamentSetup = async (
  page,
  {
    tournamentName,
    gameMode = 'doubles',
    tournamentFormat = 'league',
    format = '1',
    numTeams = 3,
  } = {}
) => {
  const startLane = page.locator('.setup-home-lane-start');
  await startLane.locator('select').nth(0).selectOption(gameMode);
  await startLane.locator('select').nth(1).selectOption(tournamentFormat);
  if (tournamentFormat === 'league') {
    await startLane.locator('select').nth(2).selectOption(format);
  }
  await startLane.getByPlaceholder(/Summer Smash 2024/i).fill(tournamentName);
  const teamsInput = startLane.locator('input[inputmode="numeric"]').first();
  if (!await teamsInput.isDisabled()) {
    await teamsInput.fill(String(numTeams));
  }
  await startLane.getByRole('button', { name: /Start Tournament/i }).click();
  await expect(page.getByRole('heading', { name: /Enter Team Details/i })).toBeVisible();
};

const fillTeamEntryDetails = async (page, teams, { gameMode = 'doubles' } = {}) => {
  for (let index = 0; index < teams.length; index += 1) {
    await page.getByPlaceholder('Team Name').nth(index).fill(teams[index].teamName);
    if (gameMode === 'singles') {
      await page.getByPlaceholder('Player Name').nth(index).fill(teams[index].players[0]);
      continue;
    }
    await page.getByPlaceholder('Player 1 Name').nth(index).fill(teams[index].players[0]);
    await page.getByPlaceholder('Player 2 Name').nth(index).fill(teams[index].players[1]);
  }
};

const createTournament = async (
  page,
  {
    tournamentName = 'E2E Night Cup',
    teams = buildLeagueTeams(3),
    gameMode = 'doubles',
    tournamentFormat = 'league',
    format = '1',
  } = {}
) => {
  await openTournamentSetup(page, {
    tournamentName,
    gameMode,
    tournamentFormat,
    format,
    numTeams: teams.length,
  });
  await fillTeamEntryDetails(page, teams, { gameMode });
  await page.getByRole('button', { name: /Generate Tournament/i }).click();
  await expect(
    page.getByRole('heading', { name: new RegExp(escapeRegExp(tournamentName), 'i'), level: 1 })
  ).toBeVisible();
  if (tournamentFormat === 'league') {
    await expect(page.locator('.live-meta-chip', { hasText: 'Match 1' })).toBeVisible();
    return;
  }
  await expect(page.getByText(/Knockout Bracket/i)).toBeVisible();
};

const createLeagueTournament = async (
  page,
  {
    tournamentName = 'E2E Night Cup',
    teams = buildLeagueTeams(3),
  } = {}
) => createTournament(page, { tournamentName, teams, gameMode: 'doubles', tournamentFormat: 'league', format: '1' });

const scheduleTournamentFromTeamEntry = async (
  page,
  {
    tournamentName = 'Scheduled Night Cup',
    teams = buildLeagueTeams(3),
    gameMode = 'doubles',
    tournamentFormat = 'league',
    format = '1',
    scheduleAt = '2026-03-18T09:30',
  } = {}
) => {
  await openTournamentSetup(page, {
    tournamentName,
    gameMode,
    tournamentFormat,
    format,
    numTeams: teams.length,
  });
  await fillTeamEntryDetails(page, teams, { gameMode });
  await page.getByRole('button', { name: /Schedule Match/i }).click();
  const scheduleInput = page.locator('.schedule-modal-shell input[type="datetime-local"]');
  await expect(scheduleInput).toBeVisible();
  await scheduleInput.fill(scheduleAt);
  await page.getByRole('button', { name: /Save Schedule/i }).click();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
};

const scoreLiveMatch = async (page, score1, score2) => {
  await page.getByPlaceholder('0').nth(0).fill(String(score1));
  await page.getByPlaceholder('0').nth(1).fill(String(score2));
  await page.getByRole('button', { name: /submit\s*&\s*continue/i }).click();
};

const completeLeagueStage = async (
  page,
  {
    leagueScores = [
      [21, 16],
      [21, 18],
      [21, 19],
    ],
  } = {}
) => {
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 1' })).toBeVisible();
  await scoreLiveMatch(page, leagueScores[0][0], leagueScores[0][1]);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
  await scoreLiveMatch(page, leagueScores[1][0], leagueScores[1][1]);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 3' })).toBeVisible();
  await scoreLiveMatch(page, leagueScores[2][0], leagueScores[2][1]);
  await expect(page.getByText(/All league matches completed!/i)).toBeVisible();
};

const completeThreeTeamLeagueTournament = async (
  page,
  {
    leagueScores = [
      [21, 16],
      [21, 18],
      [21, 19],
    ],
    finalScore = [21, 17],
  } = {}
) => {
  await completeLeagueStage(page, { leagueScores });
  await page.getByRole('button', { name: /Open Final/i }).click();
  await page.getByPlaceholder('0').nth(0).fill(String(finalScore[0]));
  await page.getByPlaceholder('0').nth(1).fill(String(finalScore[1]));
  await page.getByRole('button', { name: /Declare Champion/i }).click();
  await expect(page.getByText(/Tournament Complete!/i)).toBeVisible();
};

const getLiveTournamentRow = (page, name, extraText = '') => {
  let row = page.locator('.setup-live-row').filter({ hasText: name });
  if (extraText) {
    row = row.filter({ hasText: extraText });
  }
  return row.first();
};

const getScheduledTournamentRow = (page, name, extraText = '') => {
  let row = page.locator('.setup-scheduled-row').filter({ hasText: name });
  if (extraText) {
    row = row.filter({ hasText: extraText });
  }
  return row.first();
};

const readTournamentHistory = async (page) => page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('badminton_history') || '[]');
  } catch {
    return [];
  }
});

const goHomeFromLiveTournament = async (page) => {
  await page.getByRole('button', { name: /^Home$/i }).first().click();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
};

const resumeLiveTournament = async (page, name, extraText = '') => {
  await getLiveTournamentRow(page, name, extraText)
    .getByRole('button', { name: /^Resume$/i })
    .click();
  await expect(
    page.getByRole('heading', { name: new RegExp(escapeRegExp(name), 'i'), level: 1 })
  ).toBeVisible();
};

const clickBracketMatch = async (page, matchId) => {
  const matchCard = page.locator('.cursor-pointer').filter({
    hasText: new RegExp(`Match ${matchId}`),
  }).first();
  await expect(matchCard).toBeVisible();
  await matchCard.click();
  await expect(page.locator('.bracket-modal-shell')).toBeVisible();
};

const saveBracketMatchResult = async (page, score1, score2) => {
  const modal = page.locator('.bracket-modal-shell');
  await modal.getByPlaceholder('Score').nth(0).fill(String(score1));
  await modal.getByPlaceholder('Score').nth(1).fill(String(score2));
  await modal.getByRole('button', { name: /Save Result/i }).click();
  await expect(modal).toHaveCount(0);
};

const openEloModal = async (page) => {
  await page.getByRole('button', { name: /ELO Leaderboard/i }).click();
  await expect(page.getByRole('heading', { name: /ELO Rating Leaderboard/i })).toBeVisible();
};

const closeEloModal = async (page) => {
  await page.getByRole('button', { name: /Close elo leaderboard/i }).click();
};

const openCasualHistoryModal = async (page) => {
  await page.getByRole('button', { name: /Casual Matches \(\d+\)/i }).click();
  await expect(page.getByRole('heading', { name: /Casual Match History/i })).toBeVisible();
};

const closeCasualHistoryModal = async (page) => {
  await page.getByRole('button', { name: /Close casual history/i }).click();
};

test.beforeEach(async ({ page }) => {
  await installMockAppwrite(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('bfm:e2e:boot-cleared') === '1') {
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('bfm:e2e:boot-cleared', '1');
  });
});

test('smoke: start tournament flow', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page);

  await expect(page.locator('.live-meta-chip', { hasText: 'Match 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /submit\s*&\s*continue/i })).toBeVisible();
});

test('smoke: live scoring flow', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page);

  await page.getByPlaceholder('0').nth(0).fill('21');
  await page.getByPlaceholder('0').nth(1).fill('15');
  await page.getByRole('button', { name: /submit\s*&\s*continue/i }).click();

  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
  await expect(page.getByText(/Completed Matches \(1\/\d+\)/)).toBeVisible();
});

test('smoke: admin member management flow', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('button', { name: /Admin Hub/i }).click();
  await expect(page.getByRole('heading', { name: /Admin Hub/i })).toBeVisible();

  const targetMemberRow = page
    .locator('.request-center-member-row')
    .filter({ hasText: E2E_AUTH.member.name });
  await expect(targetMemberRow).toBeVisible();

  await targetMemberRow.getByRole('button', { name: /Make Admin/i }).click();
  await expect(
    targetMemberRow
      .locator('span')
      .filter({ hasText: /^admin$/i })
      .first()
  ).toBeVisible();

  await targetMemberRow.getByRole('button', { name: /^Remove$/i }).click();

  const confirmDialog = page.getByRole('dialog', { name: /Remove Member/i });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: /^Remove$/i }).click();

  await expect(
    page.locator('.request-center-member-row').filter({ hasText: E2E_AUTH.member.name })
  ).toHaveCount(0);
});

test('smoke: resume live tournament works after refresh', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page);

  await page.getByPlaceholder('0').nth(0).fill('21');
  await page.getByPlaceholder('0').nth(1).fill('16');
  await page.getByRole('button', { name: /submit\s*&\s*continue/i }).click();
  await expect(page.getByText(/Completed Matches \(1\/\d+\)/)).toBeVisible();

  await goHomeFromLiveTournament(page);
  const liveTournamentRow = page.locator('.setup-live-row').first();
  await expect(liveTournamentRow).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  const liveTournamentRowAfterRefresh = page.locator('.setup-live-row').first();
  await expect(liveTournamentRowAfterRefresh).toBeVisible();

  await liveTournamentRowAfterRefresh.getByRole('button', { name: /^Resume$/i }).click();
  await expect(page.locator('.live-pill', { hasText: 'LIVE NOW' })).toBeVisible();
  await expect(page.getByText(/Completed Matches \(1\/\d+\)/)).toBeVisible();
});

test('smoke: deleting live tournament clears resume state after refresh', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page);

  await goHomeFromLiveTournament(page);
  const liveTournamentRow = page.locator('.setup-live-row').first();
  await expect(liveTournamentRow).toBeVisible();

  await liveTournamentRow.getByRole('button', { name: /^Delete$/i }).click();
  const deleteDialog = page.getByRole('dialog', { name: /Delete Tournament/i });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: /^Delete$/i }).click();

  await expect(page.locator('.setup-live-row')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.locator('.setup-live-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Resume$/i })).toHaveCount(0);
});

test('smoke: full workflow resumes after refresh, completes tournament, starts next tournament, and scores again', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page, {
    tournamentName: 'League Night 1st Tournament',
    teams: buildLeagueTeams(3),
  });

  await scoreLiveMatch(page, 21, 16);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();

  await goHomeFromLiveTournament(page);
  await expect(getLiveTournamentRow(page, 'League Night 1st Tournament')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();

  await getLiveTournamentRow(page, 'League Night 1st Tournament')
    .getByRole('button', { name: /^Resume$/i })
    .click();
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();

  await scoreLiveMatch(page, 21, 18);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 3' })).toBeVisible();
  await scoreLiveMatch(page, 21, 19);
  await expect(page.getByText(/All league matches completed!/i)).toBeVisible();

  await page.getByRole('button', { name: /Open Final/i }).click();
  await page.getByPlaceholder('0').nth(0).fill('21');
  await page.getByPlaceholder('0').nth(1).fill('17');
  await page.getByRole('button', { name: /Declare Champion/i }).click();
  await expect(page.getByText(/Tournament Complete!/i)).toBeVisible();

  await page.getByRole('button', { name: /Next Tournament/i }).click();
  await expect(page.getByRole('heading', { name: /Start Next Tournament/i })).toBeVisible();
  await expect(page.locator('.tour-modal-shell input')).toHaveValue('League Night 2nd Tournament');
  await page.getByRole('button', { name: /^OK$/i }).click();

  await expect(page.getByRole('heading', { name: /League Night 2nd Tournament/i, level: 1 })).toBeVisible();
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 1' })).toBeVisible();
  await scoreLiveMatch(page, 21, 15);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
});

test('smoke: next tournament edit flow prefills teams and preserves completed history snapshot', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page, {
    tournamentName: 'Edit Flow 1st Tournament',
    teams: buildLeagueTeams(3),
  });

  await completeThreeTeamLeagueTournament(page);

  await page.getByRole('button', { name: /Next Tournament/i }).click();
  await expect(page.getByRole('heading', { name: /Start Next Tournament/i })).toBeVisible();
  await page.getByRole('button', { name: /^Edit$/i }).click();

  await expect(page.getByRole('heading', { name: /Enter Team Details/i })).toBeVisible();
  await expect(page.getByPlaceholder('Team Name').nth(0)).toHaveValue('Falcons');
  await expect(page.getByPlaceholder('Player 1 Name').nth(0)).toHaveValue('Aarav');
  await expect(page.getByPlaceholder('Player 2 Name').nth(0)).toHaveValue('Bhanu');

  await page.getByPlaceholder('Team Name').nth(0).fill('Edited Falcons');
  await page.getByRole('button', { name: /Generate Tournament/i }).click();

  await expect(page.getByRole('heading', { name: /Edit Flow 2nd Tournament/i, level: 1 })).toBeVisible();
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 1' })).toBeVisible();
});

test('smoke: multi-live home screen resumes the selected tournament after refresh', async ({ page }) => {
  await loginAsAdmin(page);
  const morningTeams = buildLeagueTeams(3, 0);
  const eveningTeams = buildLeagueTeams(3, 3);

  await createLeagueTournament(page, {
    tournamentName: 'Morning Cup',
    teams: morningTeams,
  });
  await goHomeFromLiveTournament(page);

  await createLeagueTournament(page, {
    tournamentName: 'Evening Cup',
    teams: eveningTeams,
  });
  await scoreLiveMatch(page, 21, 14);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
  await goHomeFromLiveTournament(page);

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.locator('.setup-live-row')).toHaveCount(2);

  await getLiveTournamentRow(page, 'Evening Cup')
    .getByRole('button', { name: /^Resume$/i })
    .click();
  await expect(page.getByRole('heading', { name: /Evening Cup/i, level: 1 })).toBeVisible();
  await expect(page.getByText(/Completed Matches \(1\/3\)/i)).toBeVisible();
  await expect(page.locator('.live-team-heading', { hasText: 'Lions' }).first()).toBeVisible();
});

test('smoke: deleting one duplicate-name live row leaves the other duplicate-name tournament intact', async ({ page }) => {
  await loginAsAdmin(page);

  await createLeagueTournament(page, {
    tournamentName: 'Night Cup',
    teams: buildLeagueTeams(3),
  });
  await goHomeFromLiveTournament(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.locator('.setup-live-row')).toHaveCount(1);

  await createLeagueTournament(page, {
    tournamentName: 'Night Cup',
    teams: buildLeagueTeams(4),
  });
  await goHomeFromLiveTournament(page);

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.locator('.setup-live-row')).toHaveCount(2);
  const fourTeamRow = getLiveTournamentRow(page, 'Night Cup', '4 teams');
  await expect(fourTeamRow).toBeVisible();

  await fourTeamRow.getByRole('button', { name: /^Delete$/i }).click();
  const deleteDialog = page.getByRole('dialog', { name: /Delete Tournament/i });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: /^Delete$/i }).click();

  await expect(page.locator('.setup-live-row')).toHaveCount(1);
  await expect(getLiveTournamentRow(page, 'Night Cup', '3 teams')).toBeVisible();

  await page.reload();
  await expect(page.locator('.setup-live-row')).toHaveCount(1);
  await expect(getLiveTournamentRow(page, 'Night Cup', '3 teams')).toBeVisible();
});

test('smoke: scheduled tournament can start, refresh, and resume as a live tournament', async ({ page }) => {
  await loginAsAdmin(page);
  await scheduleTournamentFromTeamEntry(page, {
    tournamentName: 'Scheduled League Cup',
    teams: buildLeagueTeams(3),
    scheduleAt: '2026-03-18T09:30',
  });

  const scheduledRow = getScheduledTournamentRow(page, 'Scheduled League Cup');
  await expect(scheduledRow).toBeVisible();
  await scheduledRow.getByRole('button', { name: /^Start$/i }).click();

  await expect(page.locator('.live-meta-chip', { hasText: 'Match 1' })).toBeVisible();
  await scoreLiveMatch(page, 21, 14);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();

  await goHomeFromLiveTournament(page);
  await expect(getLiveTournamentRow(page, 'Scheduled League Cup')).toBeVisible();
  await expect(page.locator('.setup-scheduled-row').filter({ hasText: 'Scheduled League Cup' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.locator('.setup-scheduled-row').filter({ hasText: 'Scheduled League Cup' })).toHaveCount(0);

  await resumeLiveTournament(page, 'Scheduled League Cup');
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
});

test('smoke: Delete & New clears the live tournament and stays cleared after refresh', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page, {
    tournamentName: 'Delete Reset Cup',
    teams: buildLeagueTeams(3),
  });

  await scoreLiveMatch(page, 21, 16);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();

  await page.getByRole('button', { name: /Delete & New/i }).click();
  const resetDialog = page.getByRole('dialog', { name: /Delete & Start New/i });
  await expect(resetDialog).toBeVisible();
  await resetDialog.getByRole('button', { name: /Delete & Start New/i }).click();

  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.locator('.setup-live-row').filter({ hasText: 'Delete Reset Cup' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.locator('.setup-live-row').filter({ hasText: 'Delete Reset Cup' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Resume$/i })).toHaveCount(0);
});

test('smoke: knockout tournament can refresh, resume, complete, and start the next knockout tournament', async ({ page }) => {
  await loginAsAdmin(page);
  await createTournament(page, {
    tournamentName: 'Knockout Night 1st Tournament',
    teams: buildTournamentTeams(4),
    gameMode: 'doubles',
    tournamentFormat: 'semiFinal',
  });

  await clickBracketMatch(page, 1);
  await saveBracketMatchResult(page, 21, 16);

  await goHomeFromLiveTournament(page);
  await expect(getLiveTournamentRow(page, 'Knockout Night 1st Tournament')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await resumeLiveTournament(page, 'Knockout Night 1st Tournament');
  await expect(page.getByText(/Knockout Bracket/i)).toBeVisible();

  await clickBracketMatch(page, 2);
  await saveBracketMatchResult(page, 21, 18);
  await clickBracketMatch(page, 3);
  await saveBracketMatchResult(page, 21, 19);

  await page.getByRole('button', { name: /^Final$/i }).click();
  await expect(page.getByText(/Tournament Complete!/i)).toBeVisible();

  await page.getByRole('button', { name: /Next Tournament/i }).click();
  const nextTournamentDialog = page.locator('.tour-modal-shell').filter({ hasText: 'Start Next Tournament' });
  await expect(nextTournamentDialog).toBeVisible();
  await nextTournamentDialog.getByRole('button', { name: /^Edit$/i }).click();

  await expect(page.getByRole('heading', { name: /Enter Team Details/i })).toBeVisible();
  await page.getByRole('button', { name: /Generate Tournament/i }).click();
  await expect(page.getByRole('heading', { name: /Knockout Night 2nd Tournament/i, level: 1 })).toBeVisible();
  await expect(page.getByText(/Knockout Bracket/i)).toBeVisible();
});

test('smoke: swapped team member persists after home, refresh, and resume', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page, {
    tournamentName: 'Swap Persistence Cup',
    teams: buildLeagueTeams(3),
  });

  await page.getByRole('button', { name: /Swap Team Member/i }).click();
  const swapModal = page.locator('.tour-modal-shell').filter({ hasText: 'Swap Team Member' });
  await expect(swapModal).toBeVisible();
  await swapModal.getByPlaceholder('Type or pick player name').fill('Zoya Reserve');
  await swapModal.getByRole('button', { name: /^Swap$/i }).click();

  await goHomeFromLiveTournament(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();

  await resumeLiveTournament(page, 'Swap Persistence Cup');
  await page.getByRole('button', { name: /Swap Team Member/i }).click();
  const resumedSwapModal = page.locator('.tour-modal-shell').filter({ hasText: 'Swap Team Member' });
  await expect(resumedSwapModal).toBeVisible();
  await expect(resumedSwapModal.getByText(/Aarav\s*->\s*Zoya Reserve/i)).toBeVisible();
});

test('smoke: prioritized upcoming match stays live after refresh and resume', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page, {
    tournamentName: 'Priority Cup',
    teams: buildLeagueTeams(3),
  });

  await page.locator('.live-upcoming-card').first().click();
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();

  await goHomeFromLiveTournament(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();

  await resumeLiveTournament(page, 'Priority Cup');
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
});

test('smoke: league final stage survives home, refresh, and resume', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page, {
    tournamentName: 'Final Resume Cup',
    teams: buildLeagueTeams(3),
  });

  await completeLeagueStage(page, {
    leagueScores: [
      [21, 16],
      [21, 18],
      [21, 19],
    ],
  });
  await page.getByRole('button', { name: /Open Final/i }).click();
  await expect(page.getByRole('button', { name: /Declare Champion/i })).toBeVisible();

  await goHomeFromLiveTournament(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();

  await resumeLiveTournament(page, 'Final Resume Cup');
  await page.getByRole('button', { name: /^Final$/i }).click();
  await expect(page.getByRole('button', { name: /Declare Champion/i })).toBeVisible();

  await page.getByPlaceholder('0').nth(0).fill('21');
  await page.getByPlaceholder('0').nth(1).fill('17');
  await page.getByRole('button', { name: /Declare Champion/i }).click();
  await expect(page.getByText(/Tournament Complete!/i)).toBeVisible();
});

test('smoke: offline pending sync survives refresh and flushes after reconnect', async ({ page }) => {
  const offlineMatchesPattern = '**/v1/databases/e2e-db/collections/e2e_matches/documents/**';
  await loginAsAdmin(page);
  await createLeagueTournament(page, {
    tournamentName: 'Offline Recovery Cup',
    teams: buildLeagueTeams(3),
  });

  await page.route(offlineMatchesPattern, async (route) => {
    const method = route.request().method().toUpperCase();
    if (method === 'PATCH' || method === 'PUT') {
      await route.fulfill({
        status: 503,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true',
        },
        body: JSON.stringify({
          message: 'network offline simulated',
          code: 503,
          type: 'general_network',
        }),
      });
      return;
    }
    await route.fallback();
  });

  await scoreLiveMatch(page, 21, 17);
  await expect(page.getByRole('button', { name: /\d+\s+pending sync/i })).toBeVisible();

  await page.reload();
  await expect.poll(async () => page.evaluate(() => {
    try {
      const raw = localStorage.getItem('bfm:offline-outbox:v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return -1;
    }
  })).toBeGreaterThan(0);
  if (await page.getByRole('button', { name: /Start Tournament/i }).count()) {
    await resumeLiveTournament(page, 'Offline Recovery Cup');
  }
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: /\d+\s+pending sync/i })).toBeVisible();

  await page.unroute(offlineMatchesPattern);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });

  await expect.poll(async () => page.evaluate(() => {
    try {
      const raw = localStorage.getItem('bfm:offline-outbox:v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return -1;
    }
  })).toBe(0);
  await expect(page.getByRole('button', { name: /\d+\s+pending sync/i })).toHaveCount(0);
});

test('smoke: singles and mixed doubles tournaments can start and score normally', async ({ page }) => {
  await loginAsAdmin(page);
  await createTournament(page, {
    tournamentName: 'Singles Sprint Cup',
    teams: buildTournamentTeams(3, 0, 'singles'),
    gameMode: 'singles',
    tournamentFormat: 'league',
    format: '1',
  });

  await scoreLiveMatch(page, 21, 13);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();

  await goHomeFromLiveTournament(page);
  await createTournament(page, {
    tournamentName: 'Mixed Motion Cup',
    teams: buildTournamentTeams(3, 3, 'mixed'),
    gameMode: 'mixed',
    tournamentFormat: 'league',
    format: '1',
  });

  await scoreLiveMatch(page, 21, 18);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
});

test('smoke: double round-robin league keeps the expanded fixture count', async ({ page }) => {
  await loginAsAdmin(page);
  await createTournament(page, {
    tournamentName: 'Double Round Robin Cup',
    teams: buildLeagueTeams(3),
    gameMode: 'doubles',
    tournamentFormat: 'league',
    format: '2',
  });

  await expect(page.getByText(/Coming Up Next \(5\)/i)).toBeVisible();
  await scoreLiveMatch(page, 21, 15);
  await expect(page.locator('.live-meta-chip', { hasText: 'Match 2' })).toBeVisible();
});

test('smoke: member and viewer are blocked from admin-only actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Badminton Dashboard/i })).toBeVisible();

  await loginWithCredentials({
    page,
    email: E2E_AUTH.member.email,
    password: E2E_AUTH.member.password,
  });
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Admin Hub/i })).toHaveCount(0);

  await logoutToAuthScreen(page);

  await page.getByRole('button', { name: /Continue as Viewer/i }).click();
  await expect(page.getByRole('heading', { name: /Group Hub/i })).toBeVisible();
  const publicGroup = page
    .locator('.group-hub-public-item')
    .filter({ hasText: E2E_AUTH.group.name })
    .first();
  await expect(publicGroup).toBeVisible();
  await publicGroup.getByRole('button', { name: /^Watch$/i }).click();

  await expect(page.getByRole('heading', { name: /Viewer/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Admin Hub/i })).toHaveCount(0);
});

test.describe('mobile-smoke', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('smoke: casual match create keeps history and dashboard stats consistent', async ({ page }) => {
    await loginAsAdmin(page);

    const casualDashboardCardValue = page
      .locator('.setup-dashboard-card')
      .filter({ hasText: 'Casual Matches' })
      .locator('.setup-dashboard-value');
    await expect(casualDashboardCardValue).toHaveText('0');

    await page.locator('.app-mobile-nav').getByRole('button', { name: /^Actions$/i }).click();
    await expect(page.getByRole('dialog', { name: /Mobile quick actions/i })).toBeVisible();
    await page.getByRole('button', { name: /Record Casual Match/i }).click();
    await expect(page.getByRole('heading', { name: /Record Casual Match/i })).toBeVisible();

    await page.locator('.casual-team-card-one').getByPlaceholder('Enter player name').fill('Aarav');
    await page.locator('.casual-team-card-two').getByPlaceholder('Enter player name').fill('Bhanu');
    await page.locator('.casual-team-card-one').getByPlaceholder('21').fill('21');
    await page.locator('.casual-team-card-two').getByPlaceholder('18').fill('18');

    await page.getByRole('button', { name: /Save Match & Update ELO/i }).click();
    const casualModal = page.locator('.casual-modal-shell');
    if (await casualModal.isVisible()) {
      await casualModal.locator('.casual-modal-header button').first().click({ force: true });
    }
    await expect(casualModal).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Casual Matches \(1\)/i })).toBeVisible();
    await expect(casualDashboardCardValue).toHaveText('1');

    await openCasualHistoryModal(page);
    await expect(page.getByText(/Score: 21 - 18/i)).toBeVisible();
    await closeCasualHistoryModal(page);
    await expect(page.getByRole('button', { name: /Casual Matches \(1\)/i })).toBeVisible();
    await expect(casualDashboardCardValue).toHaveText('1');
  });
});

test('smoke: tournament delete recalculates and clears ELO leaderboard when no matches remain', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page);

  await page.getByPlaceholder('0').nth(0).fill('21');
  await page.getByPlaceholder('0').nth(1).fill('16');
  await page.getByRole('button', { name: /submit\s*&\s*continue/i }).click();
  await goHomeFromLiveTournament(page);

  await openEloModal(page);
  await expect(page.locator('.setup-elo-modal-shell .elo-table-polished tbody tr').first()).toBeVisible();
  await closeEloModal(page);

  const liveTournamentRow = page.locator('.setup-live-row').first();
  await expect(liveTournamentRow).toBeVisible();
  await liveTournamentRow.getByRole('button', { name: /^Delete$/i }).click();
  const deleteDialog = page.getByRole('dialog', { name: /Delete Tournament/i });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: /^Delete$/i }).click();

  await expect(page.locator('.setup-live-row')).toHaveCount(0);

  await openEloModal(page);
  await expect(page.getByText(/No ELO ratings yet/i)).toBeVisible();
});

test('smoke: offline write queues sync and shows pending-sync indicator', async ({ page }) => {
  await loginAsAdmin(page);
  await createLeagueTournament(page);

  await page.route('**/v1/databases/e2e-db/collections/e2e_matches/documents/**', async (route) => {
    const method = route.request().method().toUpperCase();
    if (method === 'PATCH' || method === 'PUT') {
      await route.fulfill({
        status: 503,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true',
        },
        body: JSON.stringify({
          message: 'network offline simulated',
          code: 503,
          type: 'general_network',
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.getByPlaceholder('0').nth(0).fill('21');
  await page.getByPlaceholder('0').nth(1).fill('17');
  await page.getByRole('button', { name: /submit\s*&\s*continue/i }).click();

  await expect(page.getByRole('button', { name: /\d+\s+pending sync/i })).toBeVisible();

  const outboxCount = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('bfm:offline-outbox:v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
  expect(outboxCount).toBeGreaterThan(0);
});

test('smoke: join request lifecycle from request to admin approval and member access', async ({ page }) => {
  const requester = {
    name: 'Requester User',
    email: 'requester@smoke.local',
    password: 'Password123!',
  };

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Badminton Dashboard/i })).toBeVisible();

  await page.getByRole('button', { name: /^Register$/i }).click();
  await page.getByPlaceholder('Full name').fill(requester.name);
  await page.getByPlaceholder('Email').fill(requester.email);
  await page.getByPlaceholder('Password').fill(requester.password);
  await page.getByRole('button', { name: /Create account/i }).click();
  await expect(page.getByRole('heading', { name: /Group Hub/i })).toBeVisible();

  const publicGroup = page
    .locator('.group-hub-public-item')
    .filter({ hasText: E2E_AUTH.group.name })
    .first();
  await expect(publicGroup).toBeVisible();
  await publicGroup.getByRole('button', { name: /Request Entry|Request Member Access/i }).click();
  await expect(publicGroup.getByRole('button', { name: /Requested/i })).toBeVisible();

  await logoutToAuthScreen(page);

  await loginWithCredentials({
    page,
    email: E2E_AUTH.admin.email,
    password: E2E_AUTH.admin.password,
  });
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await page.getByRole('button', { name: /Admin Hub/i }).click();
  await expect(page.getByRole('heading', { name: /Admin Hub/i })).toBeVisible();

  const pendingSection = page.locator('.request-center-pending');
  const pendingRequestRow = pendingSection
    .locator('.request-center-row')
    .filter({ hasText: requester.email })
    .first();
  await expect(pendingRequestRow).toBeVisible();
  await pendingRequestRow.getByRole('button', { name: /^Approve$/i }).click();
  await expect(
    pendingSection.locator('.request-center-row').filter({ hasText: requester.email })
  ).toHaveCount(0);

  await logoutToAuthScreen(page);

  await loginWithCredentials({
    page,
    email: requester.email,
    password: requester.password,
  });
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Admin Hub/i })).toHaveCount(0);
});
