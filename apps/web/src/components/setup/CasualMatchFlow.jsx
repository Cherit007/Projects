import React from 'react';
import BoxCricketCasualMatch from '../boxCricket/BoxCricketCasualMatch';
import CasualMatch from '../CasualMatch';

const CasualMatchFlow = ({
  sportId = 'badminton',
  layout = 'inline',
  onClose,
  ...rest
}) => {
  if (sportId === 'boxCricket') {
    return (
      <BoxCricketCasualMatch
        {...rest}
        layout={layout}
        onClose={onClose}
      />
    );
  }

  return (
    <CasualMatch
      {...rest}
      sportId={sportId}
      layout={layout}
      onClose={onClose}
    />
  );
};

export default CasualMatchFlow;
