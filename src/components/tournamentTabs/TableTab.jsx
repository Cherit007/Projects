import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { getTeamQualificationStatus } from '../../utils/qualificationScenarios';

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};
const MotionSection = motion.section;
const MotionDiv = motion.div;

const TableTab = ({
  isActive,
  tournamentFormat,
  pointsTable,
  pointsTableRankMovement = new Map(),
  fixtures = [],
}) => {
  if (!isActive || tournamentFormat !== 'league') return null;

  const hasFixtureContext = Array.isArray(fixtures) && fixtures.length > 0;
  const remainingMatches = hasFixtureContext
    ? fixtures.filter((match) => !match?.completed)
    : [];
  const qualificationStatusByTeamId = new Map(
    hasFixtureContext
      ? pointsTable.map((team, index) => [
        String(team.id),
        getTeamQualificationStatus({
          team,
          standings: pointsTable,
          remainingMatches,
          rank: index + 1,
        }),
      ])
      : []
  );
  const leaderStatus = pointsTable[0]
    ? qualificationStatusByTeamId.get(String(pointsTable[0].id))
    : null;
  const secondStatus = pointsTable[1]
    ? qualificationStatusByTeamId.get(String(pointsTable[1].id))
    : null;

  return (
    <MotionSection
      key="tab-table"
      variants={tabContentMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="variant-a-card variant-a-table-shell"
    >
      <p className="variant-a-section-label">League table</p>

      <LayoutGroup id="points-table-layout">
        <div className="variant-a-table-card">
          <div className="variant-a-table-header">
            <span>#</span>
            <span>Team</span>
            <span>W</span>
            <span>L</span>
            <span>MP</span>
            <span>Pts</span>
          </div>

          {pointsTable.map((team, index) => {
            const movement = pointsTableRankMovement.get(String(team.id));
            const qualificationStatus = qualificationStatusByTeamId.get(String(team.id));
            return (
              <MotionDiv
                key={team.id}
                layout
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.65 }}
                className={`variant-a-table-row ${index === 0 ? 'variant-a-table-row-leader' : ''}`}
              >
                <span className={`variant-a-rank ${index === 0 ? 'variant-a-rank-gold' : ''}`}>{index + 1}</span>
                <div className="variant-a-team-cell">
                  <span className="variant-a-team-dot">{team.emoji}</span>
                  <p className="variant-a-team-name truncate">{team.name}</p>
                </div>
                <span className="variant-a-cell-center">{team.won}</span>
                <span className="variant-a-cell-center">{team.lost}</span>
                <span className="variant-a-cell-center">{team.played}</span>
                <span className="variant-a-points-cell">{team.points}</span>

                {(movement || qualificationStatus) && (
                  <div className="variant-a-table-meta">
                    {movement && (
                      <span className={`variant-a-move-chip ${movement.delta > 0 ? 'variant-a-move-chip-up' : 'variant-a-move-chip-down'}`}>
                        {movement.delta > 0 ? '▲' : '▼'} {Math.abs(movement.delta)}
                      </span>
                    )}
                    {qualificationStatus && (
                      <span className={`variant-a-qualification-chip variant-a-qualification-chip-${qualificationStatus.tone}`}>
                        {qualificationStatus.label}
                      </span>
                    )}
                  </div>
                )}
              </MotionDiv>
            );
          })}
        </div>
      </LayoutGroup>

      <p className="variant-a-section-label variant-a-section-label-secondary">Top 2 qualify for final</p>

      {pointsTable[0] && (
        <div className="variant-a-qualified-card">
          <div className="variant-a-qualified-head">
            <span className="variant-a-team-dot">{pointsTable[0].emoji}</span>
            <div>
              <p className="variant-a-qualified-title">
                {pointsTable[0].name} — {leaderStatus?.label || 'Leading'}
              </p>
              <p className="variant-a-qualified-copy">
                Rank #1 · {pointsTable[0].points} pts{leaderStatus?.detail ? ` · ${leaderStatus.detail}` : ''}
              </p>
            </div>
          </div>
          <p className="variant-a-qualified-note">
            {pointsTable[1]
              ? `${pointsTable[1].name} currently holds the second spot${secondStatus ? ` (${secondStatus.label}).` : '.'}`
              : 'Second place will be decided by the remaining matches.'}
          </p>
        </div>
      )}
    </MotionSection>
  );
};

export default TableTab;
