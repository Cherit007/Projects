import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LiveMatchView from '../components/LiveMatchView';
import MatchCard from '../components/MatchCard';
import FinalMatchCard from '../components/FinalMatchCard';

const teamA = { id: 't1', emoji: '🔥', name: 'Alpha', player1: 'A1', player: 'A1', player2: 'A2' };
const teamB = { id: 't2', emoji: '⚡', name: 'Beta', player1: 'B1', player: 'B1', player2: 'B2' };
const teamRovers = { id: 'rovers', emoji: '🏸', name: 'Rovers', player1: 'R1', player: 'R1', player2: 'R2' };
const teamBlues = { id: 'blues', emoji: '🔵', name: 'Blues', player1: 'B1', player: 'B1', player2: 'B2' };

const topTwoScenarioTable = [
  {
    id: 'champions',
    emoji: '🏆',
    name: 'Champions',
    points: 6,
    played: 3,
    won: 3,
    lost: 0,
    scoreFor: 63,
    scoreAgainst: 55,
    scoreDiff: 8,
    netMatchRate: 8 / 3,
  },
  {
    id: 'aces',
    emoji: '🅰️',
    name: 'Aces',
    points: 4,
    played: 2,
    won: 2,
    lost: 0,
    scoreFor: 45,
    scoreAgainst: 40,
    scoreDiff: 5,
    netMatchRate: 2.5,
  },
  {
    id: 'rovers',
    emoji: '🏸',
    name: 'Rovers',
    points: 2,
    played: 1,
    won: 1,
    lost: 0,
    scoreFor: 18,
    scoreAgainst: 20,
    scoreDiff: -2,
    netMatchRate: -2,
  },
  {
    id: 'blues',
    emoji: '🔵',
    name: 'Blues',
    points: 0,
    played: 2,
    won: 0,
    lost: 2,
    scoreFor: 30,
    scoreAgainst: 42,
    scoreDiff: -12,
    netMatchRate: -6,
  },
];

describe('Score submission guard behavior', () => {
  it('shows live Top 2 qualification guidance while scores are entered', async () => {
    const user = userEvent.setup();

    render(
      <LiveMatchView
        currentMatch={{
          id: 9,
          round: 3,
          completed: false,
          team1: teamRovers,
          team2: teamBlues,
        }}
        onSaveScore={vi.fn()}
        nextMatches={[]}
        onSelectUpcomingMatch={vi.fn()}
        tournamentName="Top 2 Cup"
        playerRatings={{}}
        playerPhotos={{}}
        pointsTable={topTwoScenarioTable}
        tournamentHistory={[]}
        casualMatches={[]}
      />
    );

    expect(screen.getByText(/Rovers: #3 with 2 pts/i)).toBeInTheDocument();
    expect(screen.getByText(/win by 8\+ to reach Top 2 now/i)).toBeInTheDocument();
    expect(screen.getByText('Blues: out of Top 2 reach on league points.')).toBeInTheDocument();

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '13');

    expect(screen.getByText('Rovers by 8 -> projected #2')).toBeInTheDocument();
    expect(screen.getByText('Rovers: projected Top 2 (#2), not qualified yet.')).toBeInTheDocument();
  });

  it('keeps live score inputs when parent save returns false', async () => {
    const user = userEvent.setup();
    const onSaveScore = vi.fn(async () => false);

    render(
      <LiveMatchView
        currentMatch={{
          id: 1,
          round: 1,
          completed: false,
          team1: teamA,
          team2: teamB,
        }}
        onSaveScore={onSaveScore}
        nextMatches={[]}
        onSelectUpcomingMatch={vi.fn()}
        tournamentName="Guard Cup"
        playerRatings={{}}
        playerPhotos={{}}
        pointsTable={[]}
        tournamentHistory={[]}
        casualMatches={[]}
      />
    );

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '18');
    await user.click(screen.getByRole('button', { name: /Submit & Continue/i }));

    expect(onSaveScore).toHaveBeenCalledWith(1, 21, 18);
    expect(score1Input).toHaveValue('21');
    expect(score2Input).toHaveValue('18');
  });

  it('blocks duplicate live submits while save is in flight', async () => {
    const user = userEvent.setup();
    let resolveSave;
    const pendingSave = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const onSaveScore = vi.fn(() => pendingSave);

    render(
      <LiveMatchView
        currentMatch={{
          id: 2,
          round: 1,
          completed: false,
          team1: teamA,
          team2: teamB,
        }}
        onSaveScore={onSaveScore}
        nextMatches={[]}
        onSelectUpcomingMatch={vi.fn()}
        tournamentName="Guard Cup"
        playerRatings={{}}
        playerPhotos={{}}
        pointsTable={[]}
        tournamentHistory={[]}
        casualMatches={[]}
      />
    );

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '15');
    const submitButton = screen.getByRole('button', { name: /Submit & Continue/i });

    await user.click(submitButton);
    await user.click(submitButton);
    expect(onSaveScore).toHaveBeenCalledTimes(1);

    resolveSave(true);
    await waitFor(() => {
      expect(score1Input).toHaveValue('');
      expect(score2Input).toHaveValue('');
    });
  });

  it('keeps match card in edit mode when parent save returns false', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => false);

    render(
      <MatchCard
        match={{
          id: 3,
          round: 1,
          completed: false,
          score1: null,
          score2: null,
          team1: teamA,
          team2: teamB,
        }}
        onSave={onSave}
      />
    );

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('Score');
    await user.type(score1Input, '21');
    await user.type(score2Input, '19');
    await user.click(screen.getByRole('button', { name: /Save Result/i }));

    expect(onSave).toHaveBeenCalledWith(3, '21', '19');
    expect(screen.getByRole('button', { name: /Save Result/i })).toBeInTheDocument();
  });

  it('exits match card edit mode when parent save succeeds', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => true);

    render(
      <MatchCard
        match={{
          id: 4,
          round: 1,
          completed: false,
          score1: null,
          score2: null,
          team1: teamA,
          team2: teamB,
        }}
        onSave={onSave}
      />
    );

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('Score');
    await user.type(score1Input, '21');
    await user.type(score2Input, '10');
    await user.click(screen.getByRole('button', { name: /Save Result/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Save Result/i })).not.toBeInTheDocument();
    });
  });

  it('blocks duplicate final submissions while save is in flight', async () => {
    const user = userEvent.setup();
    let resolveSave;
    const pendingSave = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn(() => pendingSave);

    render(
      <FinalMatchCard
        finalists={[teamA, teamB]}
        onSave={onSave}
        playerRatings={{}}
      />
    );

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '22');
    await user.type(score2Input, '20');
    const submitButton = screen.getByRole('button', { name: /Declare Champion/i });

    await user.click(submitButton);
    await user.click(submitButton);
    expect(onSave).toHaveBeenCalledTimes(1);

    resolveSave(true);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Declare Champion/i })).toBeInTheDocument();
    });
  });

  it('does not auto-move focus from final score 1 while typing', async () => {
    const user = userEvent.setup();

    render(
      <FinalMatchCard
        finalists={[teamA, teamB]}
        onSave={vi.fn(async () => true)}
        playerRatings={{}}
      />
    );

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.click(score1Input);
    await user.type(score1Input, '21');

    expect(score1Input).toHaveValue('21');
    expect(score2Input).toHaveValue('');
    expect(document.activeElement).toBe(score1Input);
  });
});
