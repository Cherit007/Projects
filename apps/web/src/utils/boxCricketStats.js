export const sortBoxCricketRunLeaders = (stats = []) => (
  [...(Array.isArray(stats) ? stats : [])].sort((left, right) => (
    (Number(right?.cricketRuns) || 0) - (Number(left?.cricketRuns) || 0)
    || (Number(right?.cricketWickets) || 0) - (Number(left?.cricketWickets) || 0)
    || String(left?.name || '').localeCompare(String(right?.name || ''))
  ))
);

export const sortBoxCricketWicketLeaders = (stats = []) => (
  [...(Array.isArray(stats) ? stats : [])].sort((left, right) => (
    (Number(right?.cricketWickets) || 0) - (Number(left?.cricketWickets) || 0)
    || (Number(right?.cricketRuns) || 0) - (Number(left?.cricketRuns) || 0)
    || String(left?.name || '').localeCompare(String(right?.name || ''))
  ))
);

export const buildBoxCricketStatsRows = (stats = [], tab = 'runs') => (
  tab === 'wickets' ? sortBoxCricketWicketLeaders(stats) : sortBoxCricketRunLeaders(stats)
);
