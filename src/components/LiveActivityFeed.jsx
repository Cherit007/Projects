import React from 'react';
import { Activity, Clock3, Play, TrendingUp, Trophy } from 'lucide-react';

const formatActivityTime = (timestamp) => {
  const numericTs = Number(timestamp);
  if (!Number.isFinite(numericTs)) return '';
  const date = new Date(numericTs);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const EVENT_META = {
  'tournament-started': {
    icon: Play,
    rowClass: 'live-activity-type-start',
  },
  'rank-changed': {
    icon: TrendingUp,
    rowClass: 'live-activity-type-rank',
  },
  'match-result': {
    icon: Trophy,
    rowClass: 'live-activity-type-match',
  },
};

const LiveActivityFeed = ({ events = [] }) => {
  const rows = Array.isArray(events) ? events.filter(Boolean) : [];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-4 sm:p-5 live-activity-shell">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 live-activity-heading">
          <Activity size={18} className="text-blue-600" />
          Live Activity Feed
        </h3>
        <span className="text-xs text-gray-500 live-activity-count">{rows.length} updates</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-5 text-center live-activity-empty">
          <Clock3 size={18} className="mx-auto mb-2 text-gray-400" />
          <p className="text-xs text-gray-600">No activity yet. Start entering match scores.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {rows.map((event, index) => {
            const meta = EVENT_META[event.type] || EVENT_META['match-result'];
            const Icon = meta.icon;
            const key = event.id || `activity-${index}`;
            const timeLabel = formatActivityTime(event.timestamp);

            return (
              <div
                key={key}
                className={`live-activity-row rounded-xl border px-3 py-2.5 flex items-start gap-3 ${meta.rowClass}`}
              >
                <div className="live-activity-icon h-7 w-7 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 live-activity-message">{event.message}</p>
                  {event.detail && (
                    <p className="text-xs text-gray-600 mt-0.5 live-activity-detail">{event.detail}</p>
                  )}
                </div>
                {timeLabel && (
                  <span className="text-[11px] text-gray-500 whitespace-nowrap live-activity-time">{timeLabel}</span>
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
