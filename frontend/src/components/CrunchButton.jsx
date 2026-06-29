import React, { useState, useEffect } from 'react';

export default function CrunchButton({ currentBlock, onCompleteTask, hasSchedule }) {
  const [completedSteps, setCompletedSteps] = useState({});

  // Reset steps completion when active task changes
  useEffect(() => {
    setCompletedSteps({});
  }, [currentBlock?.id]);

  if (!currentBlock) {
    return (
      <div className="glass-card" style={{ borderLeft: '4px solid var(--text-muted)', padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.5rem' }}>{hasSchedule ? '🎉' : '📭'}</div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700 }}>
              {hasSchedule ? "Today's Schedule Completed!" : "No Active Task Right Now"}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {hasSchedule 
                ? "You have reached the end of your scheduled day. Great job crushing your goals! 🏆" 
                : "Your schedule is currently clear. Add tasks to your board and generate a schedule to start!"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { title, start_time, end_time, type, micro_steps, task_id } = currentBlock;
  const start = new Date(start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end = new Date(end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isTask = type === 'task';
  const isBreak = type === 'break';
  const isMeeting = type === 'meeting';
  const isBuffer = type === 'buffer';

  let borderStyle = 'var(--text-muted)';
  let icon = '⚡';
  let badgeColor = 'rgba(255, 255, 255, 0.1)';
  let badgeTextColor = 'var(--text-main)';

  if (isTask) {
    borderStyle = 'var(--color-primary)';
    icon = '🎯';
    badgeColor = 'rgba(139, 92, 246, 0.15)';
    badgeTextColor = 'var(--color-primary-light)';
  } else if (isBreak) {
    borderStyle = 'var(--color-success)';
    icon = '☕';
    badgeColor = 'rgba(16, 185, 129, 0.15)';
    badgeTextColor = 'var(--color-success)';
  } else if (isMeeting) {
    borderStyle = 'var(--color-secondary)';
    icon = '👥';
    badgeColor = 'rgba(99, 102, 241, 0.15)';
    badgeTextColor = 'var(--color-secondary-light)';
  } else if (isBuffer) {
    borderStyle = 'var(--color-warning)';
    icon = '⏳';
    badgeColor = 'rgba(245, 158, 11, 0.15)';
    badgeTextColor = 'var(--color-warning)';
  }

  const toggleStep = (index) => {
    setCompletedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const stepsList = micro_steps || [];
  const totalSteps = stepsList.length;
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <div 
      className={`glass-card ${isTask ? 'crunch-pulse' : ''}`} 
      style={{ 
        borderLeft: `5px solid ${borderStyle}`,
        background: isTask ? 'rgba(139, 92, 246, 0.05)' : 'var(--bg-card)',
        padding: '1.75rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <span 
            style={{ 
              display: 'inline-block', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '999px', 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              textTransform: 'uppercase',
              backgroundColor: badgeColor,
              color: badgeTextColor,
              fontFamily: 'var(--font-heading)',
              marginBottom: '0.5rem'
            }}
          >
            {type}
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{icon}</span> {title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Time block: <strong style={{ color: 'var(--text-main)' }}>{start} - {end}</strong>
          </p>
        </div>
        
        {isTask && task_id && (
          <button 
            onClick={() => onCompleteTask(task_id)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Mark Task Done
          </button>
        )}
      </div>

      {stepsList.length > 0 ? (
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>
              Focus Steps
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {completedCount}/{totalSteps} completed ({progressPercent}%)
            </span>
          </div>

          <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '1.25rem' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${progressPercent}%`, 
                background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                borderRadius: '99px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stepsList.map((step, idx) => (
              <label 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  background: completedSteps[idx] ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0,0,0,0.15)',
                  border: '1px solid var(--border-glass)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={!!completedSteps[idx]}
                  onChange={() => toggleStep(idx)}
                  style={{ 
                    width: '18px', 
                    height: '18px', 
                    borderRadius: '4px',
                    accentColor: 'var(--color-primary)',
                    cursor: 'pointer'
                  }}
                />
                <span 
                  style={{ 
                    fontSize: '0.92rem', 
                    color: completedSteps[idx] ? 'var(--text-muted)' : 'var(--text-main)',
                    textDecoration: completedSteps[idx] ? 'line-through' : 'none',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {step}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No specific steps for this block. Focus on relaxing or attending your commitments.
        </div>
      )}
    </div>
  );
}
