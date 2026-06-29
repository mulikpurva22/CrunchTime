import React from 'react';

export default function VisualDashboard({ tasks, onResetStats, preservedStats }) {
  const totalCount = preservedStats ? preservedStats.totalCount : tasks.length;
  const completedCount = preservedStats ? preservedStats.completedCount : tasks.filter(t => t.status === 'Done').length;
  const workingCount = preservedStats ? preservedStats.inProgressCount : tasks.filter(t => t.status === 'In_Progress').length;
  const pendingCount = preservedStats ? preservedStats.pendingCount : tasks.filter(t => t.status === 'Pending').length;

  // The circular progress resets to 0% on clear as requested, but other counters stay as they are
  const percentage = preservedStats ? 0 : (totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);
  
  // SVG circle math
  const radius = 70;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Adaptive motivational messages
  let message = "Let's start ticking off some tasks! 🎯";
  if (preservedStats) {
    message = preservedStats.message;
  } else if (percentage === 100 && totalCount > 0) {
    message = "Outstanding! Today is fully completed. 🏆";
  } else if (percentage >= 70) {
    message = "You are absolutely crushing your day! 🔥";
  } else if (percentage >= 40) {
    message = "Great momentum! Keep it up. ⚡";
  } else if (percentage > 0) {
    message = "Good start! One block at a time. 🧘";
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.75rem', gap: '1.25rem', height: '100%' }}>
      
      {/* Header */}
      <div style={{ width: '100%', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🎯</span>
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Productivity Dashboard</span>
        </div>
        {onResetStats && tasks.length > 0 && (
          <button 
            onClick={onResetStats}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f43f5e', background: 'transparent' }}
            title="Wipe all tasks and schedule blocks"
          >
            🗑️ Clear Workspace
          </button>
        )}
      </div>

      {/* Circle Radial Chart */}
      <div style={{ position: 'relative', width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.5rem 0' }}>
        <svg width="180" height="180">
          <defs>
            <linearGradient id="dashboardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary-light)" />
              <stop offset="100%" stopColor="var(--color-secondary-light)" />
            </linearGradient>
          </defs>
          {/* Background circle track */}
          <circle 
            cx="90" 
            cy="90" 
            r={radius} 
            fill="transparent" 
            stroke="rgba(255, 255, 255, 0.03)" 
            strokeWidth={strokeWidth} 
          />
          {/* Active progress circle */}
          <circle 
            cx="90" 
            cy="90" 
            r={radius} 
            fill="transparent" 
            stroke="url(#dashboardGradient)" 
            strokeWidth={strokeWidth} 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round"
            className="progress-ring-circle"
          />
        </svg>
        {/* Center text details */}
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
            {percentage}%
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>
            Completed
          </span>
        </div>
      </div>

      {/* Motivation Banner */}
      <div style={{
        width: '100%',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem',
        textAlign: 'center',
        fontSize: '0.88rem',
        fontWeight: 600,
        color: 'var(--text-main)'
      }}>
        {message}
      </div>

      {/* Task Status Breakdown Lists */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
        {/* Pending Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a1a1aa' }} />
            Pending Tasks
          </span>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{pendingCount}</strong>
        </div>

        {/* Working Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary-light)' }} />
            In Progress
          </span>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{workingCount}</strong>
        </div>

        {/* Done Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} />
            Done & Finished
          </span>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{completedCount}</strong>
        </div>
      </div>

    </div>
  );
}
