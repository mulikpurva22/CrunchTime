import React from 'react';

export default function Analytics({ tasks, schedule, preservedStats }) {
  const [floatingTexts, setFloatingTexts] = React.useState([]);

  const handleXPClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newText = {
      id: Date.now() + Math.random(),
      x,
      y,
      text: "+100 XP! 🔥"
    };
    
    setFloatingTexts(prev => [...prev, newText]);
    
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== newText.id));
    }, 1000);
  };

  const completedTasks = tasks.filter(t => t.status === 'Done');
  const completedCount = preservedStats ? preservedStats.completedCount : completedTasks.length;
  const totalCount = preservedStats ? preservedStats.totalCount : tasks.length;
  const scheduledCount = preservedStats ? preservedStats.scheduledCount : schedule.filter(b => b.type === 'task').length;

  // Gamification Metrics
  const totalXP = preservedStats ? preservedStats.xp : completedCount * 100;
  const streak = preservedStats ? preservedStats.streak : (completedCount > 0 ? Math.min(5, completedCount) : 0);

  // Energy distribution
  const energyLevels = preservedStats ? {
    High: preservedStats.highEnergy,
    Medium: preservedStats.mediumEnergy,
    Low: preservedStats.lowEnergy
  } : { High: 0, Medium: 0, Low: 0 };

  if (!preservedStats) {
    tasks.forEach(t => {
      if (energyLevels[t.energy_required] !== undefined) {
        energyLevels[t.energy_required]++;
      }
    });
  }

  // Badge locks (dynamic evaluation)
  const badges = [
    {
      id: 'focus_master',
      title: 'Focus Master',
      desc: 'Completed a High-energy deep work task',
      icon: '🎯',
      unlocked: preservedStats 
        ? preservedStats.highEnergy > 0 
        : completedTasks.some(t => t.energy_required === 'High')
    },
    {
      id: 'streak_starter',
      title: 'Streak Starter',
      desc: 'Completed at least 2 tasks today',
      icon: '🔥',
      unlocked: preservedStats ? preservedStats.completedCount >= 2 : completedCount >= 2
    },
    {
      id: 'time_optimizer',
      title: 'Time Optimizer',
      desc: 'Generated an optimized AI schedule',
      icon: '⚡',
      unlocked: preservedStats ? preservedStats.scheduledCount > 0 : schedule.length > 0
    }
  ];

  const getEnergyBarWidth = (count) => {
    if (totalCount === 0) return '0%';
    return `${Math.round((count / totalCount) * 100)}%`;
  };

  return (
    <div className="glass-card" style={{ marginTop: '1.5rem' }}>
      <div className="glass-card-header">
        <h2 className="glass-card-title">
          <span>📊</span> Productivity Insights
        </h2>
        <span 
          onClick={handleXPClick}
          style={{ 
            fontSize: '0.85rem', 
            color: 'var(--color-primary-light)', 
            fontWeight: 700, 
            cursor: 'pointer', 
            position: 'relative',
            userSelect: 'none',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            background: 'rgba(139, 92, 246, 0.05)',
            border: '1px solid rgba(139, 92, 246, 0.12)'
          }}
          className="xp-badge-clickable"
          title="Click to celebrate XP!"
        >
          {totalXP} XP Accumulated
          {floatingTexts.map(t => (
            <span
              key={t.id}
              style={{
                position: 'absolute',
                left: `${t.x}px`,
                top: `${t.y}px`,
                transform: 'translate(-50%, -100%)',
                color: '#10b981',
                fontWeight: 800,
                fontSize: '0.85rem',
                pointerEvents: 'none',
                animation: 'floatUpAndFade 1.0s forwards'
              }}
            >
              {t.text}
            </span>
          ))}
        </span>
      </div>

      <div className="analytics-grid">
        <div className="analytics-stat-card">
          <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>🔥</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {streak} Days
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Focus Streak</div>
        </div>

        <div className="analytics-stat-card">
          <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>✅</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {completedCount} / {totalCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tasks Done</div>
        </div>

        <div className="analytics-stat-card">
          <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>📅</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {scheduledCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scheduled Blocks</div>
        </div>
      </div>

      {/* Energy Level Distribution */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-glass)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Energy Distribution of Tasks
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* High Energy */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#f43f5e', fontWeight: 600 }}>⚡ High Energy (Deep Focus)</span>
              <span>{energyLevels.High} tasks</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: getEnergyBarWidth(energyLevels.High), background: '#f43f5e', borderRadius: '99px', transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* Medium Energy */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#fb7185', fontWeight: 600 }}>⚡ Medium Energy</span>
              <span>{energyLevels.Medium} tasks</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: getEnergyBarWidth(energyLevels.Medium), background: '#fb7185', borderRadius: '99px', transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* Low Energy */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#fda4af', fontWeight: 600 }}>⚡ Low Energy (Fillers)</span>
              <span>{energyLevels.Low} tasks</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: getEnergyBarWidth(energyLevels.Low), background: '#fda4af', borderRadius: '99px', transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Gamified Badges */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-glass)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
          Unlocked Achievements
        </h3>
        <div className="badge-grid">
          {badges.map(badge => (
            <div key={badge.id} className={`badge-card ${badge.unlocked ? 'unlocked' : ''}`}>
              <span className="badge-icon">{badge.icon}</span>
              <div className="badge-title">{badge.title}</div>
              <div className="badge-desc">{badge.desc}</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, marginTop: '0.4rem', color: badge.unlocked ? 'var(--color-success)' : 'var(--text-muted)' }}>
                {badge.unlocked ? 'UNLOCKED' : 'LOCKED'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
