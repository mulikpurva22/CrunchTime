import React, { useEffect, useState } from 'react';

export default function AlertToasts({ onSelectTaskForChat }) {
  const [alerts, setAlerts] = useState([]);

  const fetchAlerts = async () => {
    try {
      // Query unread alerts
      const response = await fetch('/api/alerts?unread_only=true');
      if (response.ok) {
        const data = await response.json();
        
        // Check if there are new alerts that aren't in state
        setAlerts(prev => {
          const prevIds = prev.map(a => a.id);
          const newAlerts = data.filter(a => !prevIds.includes(a.id));
          return [...prev, ...newAlerts];
        });
      }
    } catch (err) {
      console.error('Failed to poll alerts:', err);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchAlerts();

    // Poll for alerts every 10 seconds
    const interval = setInterval(fetchAlerts, 10000);

    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (alertId) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/read`, {
        method: 'POST'
      });
      if (response.ok) {
        // Remove from local state
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleAction = (alert) => {
    // Call parent event to switch chatbot context to the alerting task
    onSelectTaskForChat(alert.task_id, alert.nudge_text);
    // Mark it as read
    markAsRead(alert.id);
  };

  return (
    <div className="toast-container">
      {alerts.map((alert) => (
        <div 
          key={alert.id} 
          className={`toast ${alert.risk_level === 'High' ? 'high-risk' : 'medium-risk'}`}
        >
          <div className="toast-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="toast-title" style={{ color: alert.risk_level === 'High' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
              🚨 {alert.risk_level === 'High' ? 'CRITICAL DEADLINE' : 'DEADLINE RISK'}
            </span>
            <button 
              onClick={() => markAsRead(alert.id)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              ✕
            </button>
          </div>
          <div className="toast-desc">
            {alert.nudge_text}
          </div>
          <button 
            onClick={() => handleAction(alert)}
            className="toast-action"
          >
            Let's start it now ➔
          </button>
        </div>
      ))}
    </div>
  );
}
