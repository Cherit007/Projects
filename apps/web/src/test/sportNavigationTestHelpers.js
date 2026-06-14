import { screen } from '@testing-library/react';
import { TOURNAMENT_NAME_PLACEHOLDER } from '../components/setup/sportSetupConfig';

export const SPORT_HUB_HEADING = /Choose a sport/i;

export const waitForSportHub = async (timeout = 10000) => (
  screen.findByText(SPORT_HUB_HEADING, {}, { timeout })
);

export const waitForSportHome = async (timeout = 10000) => (
  screen.findByText(/Choose format/i, {}, { timeout })
);

export const selectTournamentMatchType = async (user, timeout = 10000) => {
  await user.click(await screen.findByRole('radio', { name: /^Tournament$/i }, {}, { timeout }));
  return screen.findByPlaceholderText(TOURNAMENT_NAME_PLACEHOLDER, {}, { timeout });
};

export const enterSportWorkspace = async (user, sportLabel = 'Badminton', timeout = 10000) => {
  await waitForSportHub(timeout);
  await user.click(await screen.findByRole('button', { name: new RegExp(sportLabel, 'i') }));
  return selectTournamentMatchType(user, timeout);
};

export const waitForTournamentSetup = async (timeout = 10000) => (
  screen.findByPlaceholderText(TOURNAMENT_NAME_PLACEHOLDER, {}, { timeout })
);
