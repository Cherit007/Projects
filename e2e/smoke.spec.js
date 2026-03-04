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

const createLeagueTournament = async (page) => {
  await page.getByPlaceholder(/Summer Smash 2024/i).fill('E2E Night Cup');
  await page.getByRole('button', { name: /Start Tournament/i }).click();
  await expect(page.getByRole('heading', { name: /Enter Team Details/i })).toBeVisible();

  const teamNames = ['Falcons', 'Smash Kings', 'Net Ninjas'];
  const players = [
    ['Aarav', 'Bhanu'],
    ['Chirag', 'Dev'],
    ['Eshan', 'Farhan'],
  ];

  for (let index = 0; index < teamNames.length; index += 1) {
    await page.getByPlaceholder('Team Name').nth(index).fill(teamNames[index]);
    await page.getByPlaceholder('Player 1 Name').nth(index).fill(players[index][0]);
    await page.getByPlaceholder('Player 2 Name').nth(index).fill(players[index][1]);
  }

  await page.getByRole('button', { name: /Generate Tournament/i }).click();
  await expect(page.locator('.live-pill', { hasText: 'LIVE NOW' })).toBeVisible();
};

const goHomeFromLiveTournament = async (page) => {
  await page.getByRole('button', { name: /^Home$/i }).first().click();
  await expect(page.getByRole('button', { name: /Start Tournament/i })).toBeVisible();
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
    localStorage.clear();
    sessionStorage.clear();
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
