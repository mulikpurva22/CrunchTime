import React, { useState, useEffect } from 'react';
import CrunchButton from './components/CrunchButton';
import DailyTimeline from './components/DailyTimeline';
import TaskBoard from './components/TaskBoard';
import VisualDashboard from './components/VisualDashboard';
import AlertToasts from './components/AlertToasts';
import Analytics from './components/Analytics';
import CalendarSyncModal from './components/CalendarSyncModal';
import ConfettiOverlay from './components/ConfettiOverlay';

export default function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Sync theme state with DOM
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Mock User profile data
  const [currentUser, setCurrentUser] = useState({
    name: "Jane Doe",
    email: "jane.doe@crunchtime.ai",
    tier: "Premium Student Tier"
  });

  const [tasks, setTasks] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [currentBlock, setCurrentBlock] = useState(null);
  
  // API loading states
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  // Chat context task selector
  const [chatTaskId, setChatTaskId] = useState(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  // Hidden/completed tasks state that have been dismissed/acknowledged
  const [hiddenCompletedTaskIds, setHiddenCompletedTaskIds] = useState(() => {
    try {
      const saved = localStorage.getItem('hiddenCompletedTaskIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [justCompletedTaskId, setJustCompletedTaskId] = useState(null);

  useEffect(() => {
    localStorage.setItem('hiddenCompletedTaskIds', JSON.stringify(hiddenCompletedTaskIds));
  }, [hiddenCompletedTaskIds]);

  const handleCloseCongrats = () => {
    if (justCompletedTaskId) {
      setHiddenCompletedTaskIds(prev => [...prev, justCompletedTaskId]);
      setJustCompletedTaskId(null);
    }
    setShowCongrats(false);
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'User';
    if (hours < 12) {
      return `Good morning, ${firstName}! 🌅 Let's start the day strong.`;
    } else if (hours < 17) {
      return `Good afternoon, ${firstName}! ☀️ Keep up the great momentum.`;
    } else if (hours < 22) {
      return `Good evening, ${firstName}! 🌌 Ready to crush some goals?`;
    } else {
      return `Late night focus, ${firstName}? 🦉 Don't forget to take breaks.`;
    }
  };

  // Preserved stats for cleared workspace view
  const [preservedStats, setPreservedStats] = useState(null);
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);

  // Persistent Google Accounts list
  const defaultGoogleAccounts = [
    { name: "Jane Doe", email: "jane.doe@crunchtime.ai", tier: "Premium Student Tier" },
    { name: "John Smith", email: "john.smith@crunchtime.ai", tier: "Pro Learner Tier" }
  ];

  const [googleAccounts, setGoogleAccounts] = useState(() => {
    const saved = localStorage.getItem('crunchtime_google_accounts');
    return saved ? JSON.parse(saved) : defaultGoogleAccounts;
  });

  const addGoogleAccount = (newAcc) => {
    setGoogleAccounts(prev => {
      if (prev.some(acc => acc.email.toLowerCase() === newAcc.email.toLowerCase())) {
        return prev;
      }
      const updated = [...prev, newAcc];
      localStorage.setItem('crunchtime_google_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  // 1. Fetch tasks from backend
  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // 2. Fetch daily schedule from backend
  const fetchSchedule = async () => {
    try {
      const response = await fetch('/api/schedule');
      if (response.ok) {
        const data = await response.json();
        setSchedule(data);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTasks();
    fetchSchedule();
  }, []);

  // 3. Dynamic active block calculation based on current time
  useEffect(() => {
    const updateActiveBlock = () => {
      if (schedule.length === 0) {
        setCurrentBlock(null);
        return;
      }

      const now = new Date();
      
      // Find block where start_time <= now <= end_time
      const active = schedule.find(block => {
        const start = new Date(block.start_time);
        const end = new Date(block.end_time);
        const isHidden = block.task_id && hiddenCompletedTaskIds.includes(block.task_id);
        return now >= start && now <= end && !isHidden;
      });

      if (active) {
        setCurrentBlock(active);
      } else {
        // If no active block, find the next upcoming task block
        const upcoming = schedule.find(block => {
          const isHidden = block.task_id && hiddenCompletedTaskIds.includes(block.task_id);
          return new Date(block.start_time) > now && !isHidden;
        });
        setCurrentBlock(upcoming || null);
      }
    };

    // Update immediately and then every 5 seconds
    updateActiveBlock();
    const interval = setInterval(updateActiveBlock, 5000);
    return () => clearInterval(interval);
  }, [schedule, hiddenCompletedTaskIds]);

  // 4. Create Task
  const handleAddTask = async (taskData) => {
    setPreservedStats(null);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (response.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  // 4b. Parse and Add Bulk Tasks
  const handleParseBulkTasks = async (text) => {
    setPreservedStats(null);
    try {
      const response = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (response.ok) {
        fetchTasks();
      } else {
        throw new Error('Failed to parse bulk tasks');
      }
    } catch (err) {
      console.error('Error adding bulk tasks:', err);
      alert('Failed to parse tasks list. Please check your network and try again.');
    }
  };

  // 5. Update Task (e.g. toggle status)
  const handleUpdateTask = async (taskId, updateData) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (response.ok) {
        fetchTasks();
        // Also refresh schedule in case task completion status changes visual timeline indicators
        fetchSchedule();
        
        // Trigger congratulations overlay if task is marked Done
        if (updateData.status === 'Done') {
          setJustCompletedTaskId(taskId);
          setShowCongrats(true);
        }

        // If task is moved back to Pending or In Progress, remove from hidden completed list
        if (updateData.status === 'Pending' || updateData.status === 'In_Progress') {
          setHiddenCompletedTaskIds(prev => prev.filter(id => id !== taskId));
        }
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  // 6. Complete active block task directly
  const handleCompleteActiveTask = async (taskId) => {
    await handleUpdateTask(taskId, { status: 'Done' });
  };

  // 7. Delete Task
  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchTasks();
        fetchSchedule();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // 7b. Clear all tasks and schedule blocks (Wipe Workspace)
  const handleResetStats = async () => {
    if (!window.confirm("Are you sure you want to clear your entire workspace? This will delete all tasks and schedules.")) {
      return;
    }
    
    // Capture and preserve the current stats before wiping the task list
    const completedCount = tasks.filter(t => t.status === 'Done').length;
    const totalCount = tasks.length;
    const pendingCount = tasks.filter(t => t.status === 'Pending').length;
    const inProgressCount = tasks.filter(t => t.status === 'In_Progress').length;
    const highEnergy = tasks.filter(t => t.energy_required === 'High').length;
    const mediumEnergy = tasks.filter(t => t.energy_required === 'Medium').length;
    const lowEnergy = tasks.filter(t => t.energy_required === 'Low').length;
    const scheduledCount = schedule.filter(b => b.type === 'task').length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    let motivationalMessage = "Let's start ticking off some tasks! 🎯";
    if (percentage === 100 && totalCount > 0) {
      motivationalMessage = "Outstanding! Today is fully completed. 🏆";
    } else if (percentage >= 70) {
      motivationalMessage = "You are absolutely crushing your day! 🔥";
    } else if (percentage >= 40) {
      motivationalMessage = "Great momentum! Keep it up. ⚡";
    } else if (percentage > 0) {
      motivationalMessage = "Good start! One block at a time. 🧘";
    }

    setPreservedStats({
      completedCount,
      totalCount,
      pendingCount,
      inProgressCount,
      highEnergy,
      mediumEnergy,
      lowEnergy,
      scheduledCount,
      xp: completedCount * 100,
      streak: completedCount > 0 ? Math.min(5, completedCount) : 0,
      message: motivationalMessage
    });
    
    setHiddenCompletedTaskIds([]);
    try {
      // Delete all tasks in parallel
      await Promise.all(tasks.map(task => 
        fetch(`/api/tasks/${task.id}`, {
          method: 'DELETE'
        })
      ));
      
      // Delete all daily schedule blocks from database
      await fetch('/api/schedule', {
        method: 'DELETE'
      });
      
      // Clear schedule state
      setSchedule([]);
      
      fetchTasks();
      fetchSchedule();
    } catch (err) {
      console.error('Error clearing workspace:', err);
    }
  };

  // 8. Generate Daily Schedule via AI API
  const handleGenerateSchedule = async () => {
    setLoadingSchedule(true);
    try {
      const response = await fetch('/api/schedule/generate', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setSchedule(data);
        setHiddenCompletedTaskIds([]);
      }
    } catch (err) {
      console.error('Error generating schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // 9. Reschedule Afternoon (triggered by overloaded quick action button)
  const handleRescheduleSchedule = async () => {
    try {
      const response = await fetch('/api/schedule/generate', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setSchedule(data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error rescheduling afternoon:', err);
      return false;
    }
  };

  // Triggered by AlertToast notification actions
  const handleSelectTaskForChat = async (taskId, nudgeText) => {
    setChatTaskId(taskId);
    
    const task = tasks.find(t => t.id === taskId);
    const taskTitle = task ? task.title : 'Selected Task';
    console.log(`Starting task ${taskId}: ${taskTitle}`);
    
    // 1. Move the task to In_Progress to start working on it now!
    if (task && task.status !== 'In_Progress' && task.status !== 'Done') {
      await handleUpdateTask(taskId, { status: 'In_Progress' });
    }

    // 2. Smoothly scroll to the task board and highlight the task card
    setTimeout(() => {
      const boardElement = document.getElementById('task-board');
      if (boardElement) {
        boardElement.scrollIntoView({ behavior: 'smooth' });
        
        const cardElement = document.getElementById(`task-card-${taskId}`);
        if (cardElement) {
          cardElement.classList.add('pulse-highlight');
          setTimeout(() => {
            cardElement.classList.remove('pulse-highlight');
          }, 3000);
        }
      }
    }, 150);
  };

  // Helper to manually trigger alert worker check (convenient button on header for demoing)
  const handleTriggerAlertCheck = async () => {
    try {
      await fetch('/api/alerts/trigger-check', { method: 'POST' });
      // Alerts component will automatically poll and display the new toasts
    } catch (err) {
      console.error('Error triggering alert check:', err);
    }
  };

  const visibleTasks = tasks.filter(t => !hiddenCompletedTaskIds.includes(t.id));
  const visibleSchedule = visibleTasks.length === 0 
    ? [] 
    : schedule.filter(block => !block.task_id || !hiddenCompletedTaskIds.includes(block.task_id));

  return (
    <div className="app-container">
      {/* Toast popup notifications */}
      <AlertToasts onSelectTaskForChat={handleSelectTaskForChat} />

      {/* Header section */}
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="app-logo">
          <span>⚡</span> CrunchTime
        </h1>

        {/* Dynamic Personalized Greeting */}
        {isLoggedIn && (
          <div className="header-greeting" style={{ 
            fontSize: '0.9rem', 
            color: 'var(--text-muted)', 
            fontWeight: 500, 
            marginLeft: 'auto', 
            marginRight: '1.5rem',
            animation: 'fadeIn 0.5s ease-out'
          }}>
            {getGreeting()}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginRight: '6.5rem' }}>
          <button 
            onClick={handleTriggerAlertCheck}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            title="Forces deadline check on backend instantly"
          >
            🚨 Force alert check
          </button>
        </div>
      </header>

      {/* Floating Header Controls */}
      <div className="global-header-controls" style={{
        position: 'absolute',
        top: '2.5rem',
        right: '2.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        zIndex: 1000
      }}>
        {/* Theme Switcher Button */}
        <button 
          onClick={toggleTheme}
          className="btn-theme"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/>
              <path d="M12 20v2"/>
              <path d="m4.93 4.93 1.41 1.41"/>
              <path d="m17.66 17.66 1.41 1.41"/>
              <path d="M2 12h2"/>
              <path d="M20 12h2"/>
              <path d="m6.34 17.66-1.41 1.41"/>
              <path d="m19.07 4.93-1.41 1.41"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          )}
        </button>

        {/* User Auth Controls */}
        <div style={{ position: 'relative' }}>
          {isLoggedIn ? (
            <>
              <div 
                className="avatar-circle"
                onClick={() => setShowProfile(!showProfile)}
                title="View Profile"
              >
                {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
              </div>
              
              {showProfile && (
                <div className="profile-dropdown-card">
                  {/* Avatar & Details Section */}
                  <div className="profile-avatar-section">
                    <div className="profile-large-avatar" title="Click to upload custom avatar">
                      {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                      <div className="avatar-edit-badge">📸</div>
                    </div>
                    <div className="profile-details">
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.2' }}>{currentUser.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{currentUser.email}</div>
                      <span className={`tier-badge ${
                        currentUser.tier.includes('Premium') ? 'tier-premium' : 
                        currentUser.tier.includes('Pro') ? 'tier-pro' : 'tier-basic'
                      }`}>
                        {currentUser.tier.replace(' Tier', '')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Level & XP Progression */}
                  <div className="xp-level-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-main)' }}>🏆 Scholar Level {Math.max(1, Math.floor(tasks.filter(t => t.status === 'Done').length / 2) + 1)}</span>
                      <span style={{ color: 'var(--color-primary-light)' }}>
                        {((tasks.filter(t => t.status === 'Done').length % 2) * 50) + 50} / 100 XP
                      </span>
                    </div>
                    <div className="xp-bar-bg">
                      <div 
                        className="xp-bar-fill" 
                        style={{ width: `${((tasks.filter(t => t.status === 'Done').length % 2) * 50) + 50}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Summary Statistics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>✅ Tasks Completed:</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {tasks.filter(t => t.status === 'Done').length} / {tasks.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>📅 Today's Timeline:</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {schedule.filter(b => b.type === 'task').length} blocks
                      </span>
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <button 
                    onClick={() => {
                      setIsLoggedIn(false);
                      setShowProfile(false);
                    }}
                    className="signout-btn"
                  >
                    🚪 Sign Out Account
                  </button>
                </div>
              )}
            </>
          ) : (
            <button 
              onClick={() => setShowSignInModal(true)}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Layout grid */}
      <main className="dashboard-grid">
        
        {/* Main Column */}
        <div className="main-column">
          {/* Currently active task (Crunch Button card) */}
          <CrunchButton 
            currentBlock={currentBlock} 
            onCompleteTask={handleCompleteActiveTask}
            hasSchedule={visibleSchedule.length > 0 && !preservedStats}
          />
          
          {/* Daily Schedule Timeline */}
          <DailyTimeline 
            schedule={visibleSchedule}
            tasks={visibleTasks}
            onOpenSync={() => setIsCalendarModalOpen(true)}
            onGenerateSchedule={handleGenerateSchedule}
            loadingSchedule={loadingSchedule}
            onCompleteTask={handleCompleteActiveTask}
          />
          
          {/* Productivity Analytics dashboard */}
          <Analytics tasks={tasks} schedule={schedule} preservedStats={preservedStats} />

          {/* Kanban Task Checklist board */}
          <TaskBoard 
            tasks={visibleTasks}
            onAddTask={handleAddTask}
            onAddBulkTasks={handleParseBulkTasks}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
          />
        </div>

        {/* Sidebar Column: Visual Dashboard panel */}
        <div style={{ position: 'sticky', top: '1.5rem' }}>
          <VisualDashboard tasks={tasks} onResetStats={handleResetStats} preservedStats={preservedStats} />
        </div>

      </main>

      {/* Sign In Modal Overlay */}
      {showSignInModal && (
        <div className="auth-overlay">
          <div className="auth-modal">
            {/* Background Orbs */}
            <div className="glow-orb-purple"></div>
            <div className="glow-orb-blue"></div>

            <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', zIndex: 1 }}>
              <h3 style={{ fontSize: '1.40rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>Sign In to CrunchTime</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Unlock proactive AI scheduling and calendar syncing.</p>
            </div>
            
            {/* Quick Presets */}
            <div style={{ zIndex: 1 }}>
              <label className="auth-label">Choose a preset demo account:</label>
              <div className="preset-card-group">
                <div 
                  onClick={() => {
                    setCurrentUser({ name: "Jane Doe", email: "jane.doe@crunchtime.ai", tier: "Premium Student Tier" });
                    setIsLoggedIn(true);
                    setShowSignInModal(false);
                  }}
                  className="preset-user-card"
                >
                  <div className="preset-avatar" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }}>JD</div>
                  <span className="preset-name">Jane Doe</span>
                  <span className="preset-tier" style={{ color: '#ec4899', fontWeight: 600 }}>PREMIUM</span>
                </div>
                
                <div 
                  onClick={() => {
                    setCurrentUser({ name: "John Smith", email: "john.smith@crunchtime.ai", tier: "Pro Learner Tier" });
                    setIsLoggedIn(true);
                    setShowSignInModal(false);
                  }}
                  className="preset-user-card"
                >
                  <div className="preset-avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}>JS</div>
                  <span className="preset-name">John Smith</span>
                  <span className="preset-tier" style={{ color: '#a78bfa', fontWeight: 600 }}>PRO LEARNER</span>
                </div>
              </div>
            </div>
            
            {/* Google OAuth Button */}
            <div style={{ zIndex: 1 }}>
              <button 
                type="button" 
                onClick={() => {
                  setShowSignInModal(false);
                  setShowGooglePrompt(true);
                }}
                className="google-signin-btn"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '0.25rem' }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.7-1.57 2.69-3.88 2.69-6.57z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.71H.92v2.32C2.4 15.96 5.48 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.95 10.7c-.18-.54-.28-1.12-.28-1.7s.1-1.16.28-1.7V4.98H.92C.33 6.18 0 7.55 0 9s.33 2.82.92 4.02l3.03-2.32z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.4C13.46.97 11.41 0 9 0 5.48 0 2.4 2.04.92 4.98l3.03 2.32C4.66 5.16 6.65 3.58 9 3.58z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0', zIndex: 1 }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)' }} />
              <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>OR CREATE CUSTOM ACCOUNT</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            </div>

            {/* Custom fields form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const customUser = {
                  name: formData.get("name") || "Custom User",
                  email: formData.get("email") || "custom@crunchtime.ai",
                  tier: formData.get("tier") || "Basic Student Tier"
                };
                setCurrentUser(customUser);
                setIsLoggedIn(true);
                setShowSignInModal(false);
                addGoogleAccount(customUser);
              }} 
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 1 }}
            >
              <div className="auth-form-group">
                <label className="auth-label">Full Name</label>
                <input required type="text" name="name" className="auth-input-field" placeholder="e.g. Alice Vance" />
              </div>
              
              <div className="auth-form-group">
                <label className="auth-label">Email Address</label>
                <input required type="email" name="email" className="auth-input-field" placeholder="e.g. alice@crunchtime.ai" />
              </div>
              
              <div className="auth-form-group">
                <label className="auth-label">Enrollment / Account Type</label>
                <select name="tier" className="auth-input-field" style={{ background: '#121218' }}>
                  <option value="Premium Student Tier">Premium Student Tier</option>
                  <option value="Pro Learner Tier">Pro Learner Tier</option>
                  <option value="Basic Student Tier">Basic Student Tier</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setShowSignInModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.65rem' }}>
                  Register & Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulated Google Account Selector Popup */}
      {showGooglePrompt && (
        <div className="google-prompt-overlay">
          <div className="google-prompt-card">
            {/* Google Logo */}
            <div className="google-logo-container">
              <svg width="74" height="24" viewBox="0 0 74 24" fill="none">
                <path d="M9.25 18.2c-4.13 0-7.5-3.32-7.5-7.43s3.37-7.43 7.5-7.43c2.25 0 3.96.88 5.2 2.07l-1.83 1.83c-.88-.84-2.07-1.46-3.37-1.46-2.73 0-4.97 2.22-4.97 4.99s2.24 4.99 4.97 4.99c2.86 0 3.91-1.92 4.08-2.92H9.25v-2.5h6.58c.08.35.13.78.13 1.25.01 1.95-.53 4.23-2.28 5.97-1.68 1.74-3.83 2.7-6.93 2.7zm14.33-.24c-2.48 0-4.48-1.93-4.48-4.43 0-2.53 2-4.46 4.48-4.46 2.45 0 4.45 1.93 4.45 4.46s-2 4.43-4.45 4.43zm0-2.18c1.3 0 2.33-1.07 2.33-2.25s-1.03-2.28-2.33-2.28c-1.33 0-2.36 1.1-2.36 2.28s1.03 2.25 2.36 2.25zm10.5 2.18c-2.48 0-4.48-1.93-4.48-4.43 0-2.53 2-4.46 4.48-4.46 2.45 0 4.45 1.93 4.45 4.46s-2 4.43-4.45 4.43zm0-2.18c1.3 0 2.33-1.07 2.33-2.25s-1.03-2.28-2.33-2.28c-1.33 0-2.36 1.1-2.36 2.28s1.03 2.25 2.36 2.25zM45.5 18.2c-2.45 0-4.13-1.78-4.13-4.38v-.15c0-2.67 1.83-4.46 3.98-4.46 2.25 0 3.65 1.63 3.65 4.3v.78h-5.48c.15 1.05 1 1.73 2.05 1.73.85 0 1.55-.42 1.95-1.05l1.95 1.3c-.63 1-1.85 1.93-4 1.93zm-.15-7.73c-1 0-1.75.68-1.93 1.58h3.8c-.05-.9-.75-1.58-1.87-1.58zM53 23.5V3.75h2.15v19.75H53zm11.75-5.54c-2.48 0-4.23-1.83-4.23-4.43 0-2.65 1.8-4.46 4.23-4.46 2.42 0 4.15 1.83 4.15 4.46s-1.73 4.43-4.15 4.43zm0-2.18c1.23 0 2.08-1.03 2.08-2.25s-.85-2.28-2.08-2.28c-1.25 0-2.15 1.05-2.15 2.28s.9 2.25 2.15 2.25z" fill="#757575"/>
              </svg>
            </div>

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 400, margin: 0, color: '#202124' }}>Choose an account</h3>
              <p style={{ fontSize: '0.9rem', color: '#5f6368', margin: '0.35rem 0 0 0' }}>to continue to <strong style={{ color: '#202124' }}>CrunchTime</strong></p>
            </div>

            {/* Account Selector List */}
            <div className="google-account-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {googleAccounts.map((acc, index) => (
                <button 
                  key={index}
                  type="button"
                  onClick={() => {
                    setCurrentUser(acc);
                    setIsLoggedIn(true);
                    setShowGooglePrompt(false);
                  }}
                  className="google-account-row"
                >
                  <div className="google-account-avatar" style={{ 
                    backgroundColor: index % 3 === 0 ? '#1a73e8' : index % 3 === 1 ? '#e91e63' : '#2ec4b6' 
                  }}>
                    {acc.name ? acc.name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="google-account-info">
                    <span className="google-account-name">{acc.name}</span>
                    <span className="google-account-email">{acc.email}</span>
                  </div>
                </button>
              ))}

              <button 
                type="button"
                onClick={() => {
                  const name = prompt("Enter your Google Account Name:", "Purva Mulik");
                  if (!name) return;
                  const email = prompt("Enter your Google Email Address:", "purva@gmail.com");
                  if (!email) return;
                  
                  const customUser = { name, email, tier: "Premium Student Tier" };
                  setCurrentUser(customUser);
                  setIsLoggedIn(true);
                  setShowGooglePrompt(false);
                  addGoogleAccount(customUser);
                }}
                className="google-account-row"
              >
                <div className="google-account-avatar" style={{ backgroundColor: '#f1f3f4', color: '#5f6368' }}>👤</div>
                <div className="google-account-info">
                  <span className="google-account-name" style={{ color: '#5f6368' }}>Use another account</span>
                </div>
              </button>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#5f6368', lineHeight: '1.4', textAlign: 'left', marginTop: '0.5rem' }}>
              To continue, Google will share your name, email address, language preference, and profile picture with CrunchTime. See Google's Privacy Policy.
            </div>

            <button 
              type="button" 
              onClick={() => {
                setShowGooglePrompt(false);
                setShowSignInModal(true);
              }} 
              style={{
                background: 'transparent',
                border: 'none',
                color: '#1a73e8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                alignSelf: 'flex-start',
                padding: '0.5rem 0'
              }}
            >
              Back to standard sign in
            </button>
          </div>
        </div>
      )}

      {/* Calendar Sync Settings Modal Simulator */}
      <CalendarSyncModal 
        isOpen={isCalendarModalOpen} 
        onClose={() => setIsCalendarModalOpen(false)} 
      />

      {/* Full-screen Congratulations & Confetti Overlay */}
      <ConfettiOverlay 
        isOpen={showCongrats} 
        onClose={handleCloseCongrats} 
      />
    </div>
  );
}
