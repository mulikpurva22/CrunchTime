import React, { useState, useEffect } from 'react';

export default function DailyTimeline({ schedule, tasks, onOpenSync, onGenerateSchedule, loadingSchedule, onCompleteTask }) {
  const [now, setNow] = useState(new Date());

  // Update clock every 5 seconds to keep "Active Now" indicator accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!schedule || schedule.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))' }}>📅</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800 }}>
          Daily Schedule Timeline
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.5rem', maxWidth: '440px', margin: '0.5rem auto 1.5rem', lineHeight: 1.6 }}>
          No active schedule generated for today. Add your tasks and click below to build your optimized, hour-by-hour AI schedule!
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {onOpenSync && (
            <button 
              onClick={onOpenSync} 
              className="btn btn-secondary"
              style={{ borderRadius: '99px', padding: '0.5rem 1.2rem' }}
            >
              🔌 Sync Settings
            </button>
          )}
          {onGenerateSchedule && (
            <button 
              onClick={onGenerateSchedule} 
              disabled={loadingSchedule}
              className="btn btn-primary"
              style={{ borderRadius: '99px', padding: '0.5rem 1.5rem' }}
            >
              {loadingSchedule ? 'Optimizing Agenda...' : 'Generate AI Schedule'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Sort schedule by start time
  const sortedBlocks = [...schedule].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // Formatter helpers
  const formatClockTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const calculateDuration = (startIso, endIso) => {
    const durationMs = new Date(endIso) - new Date(startIso);
    const durationMins = Math.round(durationMs / (1000 * 60));
    if (durationMins >= 60) {
      const hrs = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    return `${durationMins} min`;
  };

  // Helper to check if block is active
  const isBlockActive = (block) => {
    const start = new Date(block.start_time);
    const end = new Date(block.end_time);
    return now >= start && now <= end;
  };

  return (
    <div className="glass-card" style={{ position: 'relative' }}>
      
      {/* Header controls */}
      <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="glass-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📅</span> Daily Schedule Timeline
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onOpenSync && (
            <button 
              onClick={onOpenSync} 
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            >
              🔌 Sync Settings
            </button>
          )}
          {onGenerateSchedule && (
            <button 
              onClick={onGenerateSchedule} 
              disabled={loadingSchedule}
              className="btn btn-primary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            >
              {loadingSchedule ? 'Optimizing...' : 'Generate AI Schedule'}
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
        Your chronological daily agenda, including deep focus blocks, meetings, buffers, and breaks.
      </p>

      {/* Timeline List */}
      <div className="timeline-container">
        {sortedBlocks.map((block, idx) => {
          const isActive = isBlockActive(block);
          const blockStart = formatClockTime(block.start_time);
          const blockEnd = formatClockTime(block.end_time);
          const durationStr = calculateDuration(block.start_time, block.end_time);
          
          let icon = '⚡';
          let borderGlowStyle = {};
          if (isActive) {
            borderGlowStyle = {
              border: '1.5px solid var(--color-primary-light)',
              boxShadow: '0 0 15px var(--color-primary-glow)',
              transform: 'scale(1.01)',
              background: block.type === 'task' 
                ? 'rgba(139, 92, 246, 0.12)' 
                : 'rgba(255, 255, 255, 0.05)',
            };
          }

          if (block.type === 'task') icon = '🎯';
          else if (block.type === 'break') icon = '☕';
          else if (block.type === 'meeting') icon = '👥';
          else if (block.type === 'buffer') icon = '⏳';

          // Parse micro steps list
          const stepsList = Array.isArray(block.micro_steps) 
            ? block.micro_steps 
            : typeof block.micro_steps === 'string' 
              ? JSON.parse(block.micro_steps || '[]') 
              : [];

          return (
            <div 
              key={block.id || idx} 
              className={`timeline-block ${block.type} ${isActive && block.type === 'task' ? 'crunch-pulse' : ''}`}
              style={{
                ...borderGlowStyle,
                position: 'relative',
                transition: 'var(--transition-smooth)'
              }}
            >
              {/* Timeline Time section */}
              <div className="timeline-time" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {blockStart}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  to {blockEnd}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}>
                  🕒 {durationStr}
                </span>
              </div>

              {/* Timeline Content section */}
              <div className="timeline-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                    <span className="timeline-title" style={{ color: 'var(--text-main)' }}>
                      {block.title}
                    </span>
                  </div>
                  
                  {/* Action Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isActive && (
                      <span 
                        style={{ 
                          fontSize: '0.7rem', 
                          fontWeight: 800, 
                          backgroundColor: 'rgba(139, 92, 246, 0.2)', 
                          color: 'var(--color-primary-light)', 
                          border: '1.5px solid var(--color-primary-light)',
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '99px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em'
                        }}
                      >
                        ⚡ Active Now
                      </span>
                    )}

                    {block.type === 'task' && block.task_id && onCompleteTask && (
                      <button
                        onClick={() => onCompleteTask(block.task_id)}
                        className="btn btn-secondary"
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: 'var(--color-success)',
                          background: 'transparent',
                          transition: 'var(--transition-smooth)'
                        }}
                        title="Mark task as completed"
                      >
                        ✓ Done
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-steps / details */}
                {stepsList.length > 0 && (
                  <ul className="timeline-steps" style={{ margin: '0.5rem 0 0 0.5rem', paddingLeft: '0.2rem' }}>
                    {stepsList.map((step, sIdx) => (
                      <li key={sIdx} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                        {step}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
