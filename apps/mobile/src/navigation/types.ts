import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  SportHub: undefined;
  TournamentSetup: undefined;
  Teams: undefined;
  Tournament: undefined;
  CasualMatch: undefined;
  History: undefined;
  EloLeaderboard: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Live: undefined;
  Start: undefined;
  Stats: undefined;
  Profile: undefined;
};

export type GroupSummary = {
  id: string;
  name: string;
  role: string;
};

export type AppUser = {
  $id: string;
  name?: string;
  email?: string;
};
