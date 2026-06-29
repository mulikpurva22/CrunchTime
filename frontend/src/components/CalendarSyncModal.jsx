import React, { useState } from 'react';

export default function CalendarSyncModal({ isOpen, onClose }) {
  const [googleConnected, setGoogleConnected] = useState(true);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [appleConnected, setAppleConnected] = useState(false);

  const [syncLunch, setSyncLunch] = useState(true);
  const [enforceBuffers, setEnforceBuffers] = useState(true);
  
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const handleSyncTrigger = () => {
    setSyncing(true);
    setProgress(0);
    
    // Simulate progress tick
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setSyncing(false);
            alert("Calendar sync completed successfully! today's standups and meetings loaded.");
          }, 400);
          return 100;
        }
        return prev + 20;
      });
    }, 250);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ width: '420px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔌</span> Calendar Integration Sync
          </h3>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>

        {syncing ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(139, 92, 246, 0.1)',
              borderTop: '4px solid var(--color-primary-light)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Syncing calendar commitments... {progress}%</div>
            
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-primary-light)', transition: 'width 0.25s ease' }} />
            </div>
          </div>
        ) : (
          <>
            {/* Account Info */}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Connected account: <strong style={{ color: 'var(--text-main)' }}>demo@crunchtime.ai</strong>
            </div>

            {/* Integrations checklist */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                Select Active Calendars
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span>🔴</span> Google Calendar
                  </span>
                  <input type="checkbox" checked={googleConnected} onChange={(e) => setGoogleConnected(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span>🔵</span> Outlook Calendar
                  </span>
                  <input type="checkbox" checked={outlookConnected} onChange={(e) => setOutlookConnected(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span>⚪</span> Apple Calendar
                  </span>
                  <input type="checkbox" checked={appleConnected} onChange={(e) => setAppleConnected(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }} />
                </label>
              </div>
            </div>

            {/* Sync options */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                Scheduling Preferences
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={syncLunch} onChange={(e) => setSyncLunch(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
                  <span>Schedule around lunch breaks (12:00 PM - 1:00 PM)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={enforceBuffers} onChange={(e) => setEnforceBuffers(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
                  <span>Enforce 10-minute buffers after meetings</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                onClick={onClose} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.6rem' }}
              >
                Close
              </button>
              <button 
                onClick={handleSyncTrigger} 
                className="btn btn-primary" 
                style={{ flex: 1.5, padding: '0.6rem' }}
              >
                🔄 Trigger Sync Now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
