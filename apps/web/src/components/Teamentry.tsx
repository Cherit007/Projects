import React from 'react';
import TeamEntry from './Teamentry.jsx';
import TeamEntrySquad from './teamEntry/TeamEntrySquad.jsx';
import { getSport } from '@fixture-maker/domain/sports';

const TeamEntryScreen = (props) => {
  const sport = getSport(props.sportId);
  if (sport.participantModel === 'squad') {
    return <TeamEntrySquad {...props} />;
  }
  return <TeamEntry {...props} />;
};

export default TeamEntryScreen;

