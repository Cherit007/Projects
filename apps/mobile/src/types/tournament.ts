export type TeamDraft = {
  id: number;
  name: string;
  emoji: string;
  player1: string;
  player2: string;
  player?: string;
};

export type FixtureMatch = {
  id: string | number;
  round?: number;
  team1: TeamDraft;
  team2: TeamDraft;
  score1?: number | string | null;
  score2?: number | string | null;
  completed?: boolean;
};

export type TournamentDraft = {
  id: string;
  appwriteId: string | null;
  name: string;
  sportId: string;
  gameMode: string;
  tournamentFormat: string;
  format: string;
  teams: TeamDraft[];
  fixtures: FixtureMatch[];
  bracket: FixtureMatch[][];
  status: 'draft' | 'active' | 'completed';
  champion: TeamDraft | null;
  createdAt: string;
  updatedAt: string;
};
