import React from 'react';

const formatActivityTime = (timestamp) => {
  const numericTs = Number(timestamp);
  if (!Number.isFinite(numericTs)) return '';
  const date = new Date(numericTs);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const EVENT_META = {
  'tournament-started': {
    icon: '▶',
    tone: 'neutral',
  },
  'rank-changed': {
    icon: '↑',
    tone: 'up',
  },
  'match-result': {
    icon: '🏆',
    tone: 'match',
  },
};

const LiveActivityFeed = ({ events = [] }) => {
  const rows = Array.isArray(events) ? events.filter(Boolean) : [];

  return (
    <div className="variant-a-card variant-a-history-card live-activity-shell">
      <div className="variant-a-history-head">
        <div className="variant-a-section-head">
          <p className="variant-a-section-label !mb-0">Activity</p>
        </div>
        <span className="variant-a-meta-copy live-activity-count">{rows.length} updates</span>
      </div>

      {rows.length === 0 ? (
        <div className="variant-a-empty-card live-activity-empty">
          <p>No activity yet. Start entering match scores.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {rows.map((event, index) => {
            const meta = EVENT_META[event.type] || EVENT_META['match-result'];
            const key = event.id || `activity-${index}`;
            const timeLabel = formatActivityTime(event.timestamp);

            return (
              <div
                key={key}
                className={`variant-a-activity-row live-activity-row live-activity-type-${event.type || 'match-result'} live-activity-tone-${meta.tone}`}
              >
                <div className="variant-a-activity-icon live-activity-icon">{meta.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="variant-a-activity-title live-activity-message">{event.message}</p>
                  {event.detail && (
                    <p className="variant-a-activity-copy live-activity-detail">{event.detail}</p>
                  )}
                </div>
                {timeLabel && (
                  <span className="variant-a-activity-time live-activity-time">{timeLabel}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveActivityFeed;
