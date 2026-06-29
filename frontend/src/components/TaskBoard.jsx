import React, { useState } from 'react';

export default function TaskBoard({ tasks, onAddTask, onAddBulkTasks, onUpdateTask, onDeleteTask }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('single'); // 'single' or 'bulk'
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);
  
  // Single Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [priority, setPriority] = useState(5);
  const [energy, setEnergy] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [tags, setTags] = useState('');

  // Bulk Form State
  const [bulkText, setBulkText] = useState('');
  const [loadingBulk, setLoadingBulk] = useState(false);

  const handleSingleSubmit = (e) => {
    e.preventDefault();
    if (!title || !deadline) return;
    
    onAddTask({
      title,
      description,
      estimated_duration_mins: parseInt(duration),
      priority_score: parseInt(priority),
      deadline: new Date(deadline).toISOString(),
      status: 'Pending',
      energy_required: energy,
      tags: tags || null
    });

    // Reset Form
    setTitle('');
    setDescription('');
    setDuration(60);
    setPriority(5);
    setEnergy('Medium');
    setDeadline('');
    setTags('');
    setShowAddForm(false);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    setLoadingBulk(true);
    try {
      await onAddBulkTasks(bulkText);
      setBulkText('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error submitting bulk tasks:', err);
    } finally {
      setLoadingBulk(false);
    }
  };

  // Sorting helper: Sorts by Priority (descending, highest first), then by Deadline (ascending, earliest first)
  const sortTasks = (taskList) => {
    return [...taskList].sort((a, b) => {
      if (b.priority_score !== a.priority_score) {
        return b.priority_score - a.priority_score;
      }
      return new Date(a.deadline) - new Date(b.deadline);
    });
  };

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const pendingTasks = sortTasks(filteredTasks.filter(t => t.status === 'Pending'));
  const inProgressTasks = sortTasks(filteredTasks.filter(t => t.status === 'In_Progress'));
  const completedTasks = sortTasks(filteredTasks.filter(t => t.status === 'Done'));

  const getPriorityBadge = (score) => {
    let color = 'var(--text-muted)';
    if (score >= 8) color = 'var(--color-danger)';
    else if (score >= 5) color = 'var(--color-warning)';
    else color = 'var(--color-success)';

    return (
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color, background: 'rgba(255,255,255,0.03)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
        P{score}
      </span>
    );
  };

  const getEnergyColor = (level) => {
    if (level === 'High') return '#f43f5e';
    if (level === 'Medium') return '#fb7185';
    return '#fda4af';
  };

  const TaskCard = ({ task }) => {
    const deadDate = new Date(task.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    return (
      <div 
        id={`task-card-${task.id}`}
        className="glass-card task-card" 
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id.toString());
          e.currentTarget.classList.add('dragging');
        }}
        onDragEnd={(e) => {
          e.currentTarget.classList.remove('dragging');
        }}
        style={{ 
          padding: '1rem', 
          marginBottom: '0.75rem', 
          background: 'rgba(255, 255, 255, 0.02)',
          borderLeft: `3px solid ${task.status === 'Done' ? 'var(--color-success)' : 'var(--color-primary)'}`,
          transition: 'var(--transition-smooth)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: task.status === 'Done' ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: task.status === 'Done' ? 'line-through' : 'none' }}>
            {task.title}
          </h4>
          <button 
            onClick={() => onDeleteTask(task.id)}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', opacity: 0.6, fontSize: '0.85rem' }}
            title="Delete task"
          >
            🗑️
          </button>
        </div>
        
        {task.description && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {task.description}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          {getPriorityBadge(task.priority_score)}
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            ⏱️ {task.estimated_duration_mins}m
          </span>
          <span style={{ fontSize: '0.7rem', color: getEnergyColor(task.energy_required), fontWeight: 600 }}>
            ⚡ {task.energy_required}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div>Due: <span style={{ color: 'var(--text-main)' }}>{deadDate}</span></div>
          
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {task.status !== 'Pending' && (
              <button 
                onClick={() => onUpdateTask(task.id, { status: 'Pending' })}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '3px', padding: '0.1rem 0.3rem', color: 'var(--text-main)', cursor: 'pointer' }}
              >
                ◀
              </button>
            )}
            {task.status !== 'In_Progress' && task.status !== 'Done' && (
              <button 
                onClick={() => onUpdateTask(task.id, { status: 'In_Progress' })}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '3px', padding: '0.1rem 0.3rem', color: 'var(--text-main)', cursor: 'pointer' }}
                title="Start working"
              >
                ▶
              </button>
            )}
            {task.status !== 'Done' && (
              <button 
                onClick={() => onUpdateTask(task.id, { status: 'Done' })}
                style={{ background: 'rgba(16, 185, 129, 0.15)', border: 'none', borderRadius: '3px', padding: '0.1rem 0.3rem', color: 'var(--color-success)', cursor: 'pointer', fontWeight: 'bold' }}
                title="Complete task"
              >
                ✓
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="task-board" className="glass-card">
      <div className="glass-card-header">
        <h2 className="glass-card-title">
          <span>📋</span> Task Board
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          {showAddForm ? 'Close Form' : '+ Add Task'}
        </button>
      </div>

      {showAddForm && (
        <div className="glass-card" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem', padding: '1rem' }}>
          {/* Form Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
            <button 
              onClick={() => setActiveFormTab('single')}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeFormTab === 'single' ? 'var(--color-primary-light)' : 'var(--text-muted)',
                fontWeight: activeFormTab === 'single' ? 700 : 500,
                borderBottom: activeFormTab === 'single' ? '2px solid var(--color-primary)' : 'none',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)'
              }}
            >
              Single Task
            </button>
            <button 
              onClick={() => setActiveFormTab('bulk')}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeFormTab === 'bulk' ? 'var(--color-primary-light)' : 'var(--text-muted)',
                fontWeight: activeFormTab === 'bulk' ? 700 : 500,
                borderBottom: activeFormTab === 'bulk' ? '2px solid var(--color-primary)' : 'none',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)'
              }}
            >
              Bulk Add (AI Parser)
            </button>
          </div>

          {activeFormTab === 'single' ? (
            <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Task Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Write report" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="input-field" 
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Description</label>
                <textarea 
                  placeholder="Provide a brief description..." 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  className="input-field"
                  rows={2}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Duration (minutes)</label>
                  <input 
                    type="number" 
                    value={duration} 
                    onChange={e => setDuration(e.target.value)} 
                    className="input-field"
                    min={5}
                    max={1440}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Priority (1-10)</label>
                  <input 
                    type="number" 
                    value={priority} 
                    onChange={e => setPriority(e.target.value)} 
                    className="input-field"
                    min={1}
                    max={10}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Energy Required</label>
                  <select value={energy} onChange={e => setEnergy(e.target.value)} className="input-field">
                    <option value="Low">Low (Fills, easy)</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High (Deep focus)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Tags (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="work,code" 
                    value={tags} 
                    onChange={e => setTags(e.target.value)} 
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Deadline *</label>
                <input 
                  type="datetime-local" 
                  value={deadline} 
                  onChange={e => setDeadline(e.target.value)} 
                  className="input-field"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                Save Task
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Paste Tasks List (one per line)
                </label>
                <textarea 
                  placeholder="- Fix bug (Priority: 9, takes 60 mins)&#10;- Write presentation slides (P:7, 45m)&#10;- Order lunches (Priority 3, 15 minutes)" 
                  value={bulkText} 
                  onChange={e => setBulkText(e.target.value)} 
                  className="input-field"
                  rows={6}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                  💡 The AI parser will automatically extract the title, estimated time, and priority score.
                </p>
              </div>
              <button 
                type="submit" 
                disabled={loadingBulk}
                className="btn btn-primary" 
                style={{ marginTop: '0.5rem' }}
              >
                {loadingBulk ? 'Extracting Tasks...' : 'Parse & Add Tasks'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Search Filter */}
      <div style={{ marginBottom: '1.25rem' }}>
        <input 
          type="text" 
          placeholder="🔍 Search tasks by title..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="input-field"
          style={{ padding: '0.5rem 0.8rem', fontSize: '0.88rem' }}
        />
      </div>

      {/* Kanban Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', overflowX: 'auto', minWidth: '500px' }}>
        
        {/* Column: Pending */}
        <div
          className={`kanban-column ${draggedOverColumn === 'Pending' ? 'drag-over' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setDraggedOverColumn('Pending')}
          onDragLeave={() => setDraggedOverColumn(null)}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/plain');
            if (id) {
              onUpdateTask(parseInt(id), { status: 'Pending' });
            }
            setDraggedOverColumn(null);
          }}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
        >
          <h3 style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>⏳</span> Pending ({pendingTasks.length})
          </h3>
          <div style={{ minHeight: '200px' }}>
            {pendingTasks.map(task => <TaskCard key={task.id} task={task} />)}
            {pendingTasks.length === 0 && (
              <div style={{ border: '2px dashed var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Empty (Drop here)
              </div>
            )}
          </div>
        </div>

        {/* Column: In Progress */}
        <div
          className={`kanban-column ${draggedOverColumn === 'In_Progress' ? 'drag-over' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setDraggedOverColumn('In_Progress')}
          onDragLeave={() => setDraggedOverColumn(null)}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/plain');
            if (id) {
              onUpdateTask(parseInt(id), { status: 'In_Progress' });
            }
            setDraggedOverColumn(null);
          }}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
        >
          <h3 style={{ fontSize: '0.88rem', color: 'var(--color-primary-light)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>🔥</span> Working ({inProgressTasks.length})
          </h3>
          <div style={{ minHeight: '200px' }}>
            {inProgressTasks.map(task => <TaskCard key={task.id} task={task} />)}
            {inProgressTasks.length === 0 && (
              <div style={{ border: '2px dashed var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Empty (Drop here)
              </div>
            )}
          </div>
        </div>

        {/* Column: Completed */}
        <div
          className={`kanban-column ${draggedOverColumn === 'Done' ? 'drag-over' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setDraggedOverColumn('Done')}
          onDragLeave={() => setDraggedOverColumn(null)}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/plain');
            if (id) {
              onUpdateTask(parseInt(id), { status: 'Done' });
            }
            setDraggedOverColumn(null);
          }}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
        >
          <h3 style={{ fontSize: '0.88rem', color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>✓</span> Done ({completedTasks.length})
          </h3>
          <div style={{ minHeight: '200px' }}>
            {completedTasks.map(task => <TaskCard key={task.id} task={task} />)}
            {completedTasks.length === 0 && (
              <div style={{ border: '2px dashed var(--border-glass)', borderRadius: 'var(--radius-sm)', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Empty (Drop here)
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
