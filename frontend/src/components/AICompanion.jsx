import React, { useState, useRef, useEffect } from 'react';

export default function AICompanion({ activeTaskId, onRescheduleSchedule, onRefreshSchedule }) {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hey! I'm your CrunchTime co-pilot. How can I help you tackle your schedule today?"
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          task_id: activeTaskId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
        if (data.should_refresh && onRefreshSchedule) {
          onRefreshSchedule();
        }
      } else {
        throw new Error('Failed to fetch chat response');
      }
    } catch (err) {
      setMessages(prev => [
        ...prev, 
        { sender: 'ai', text: "Sorry, I had trouble connecting. Make sure your local API is running and configured correctly!" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    setRescheduling(true);
    setMessages(prev => [
      ...prev,
      { sender: 'user', text: "I'm feeling overwhelmed, reschedule my afternoon." }
    ]);

    try {
      // Trigger the schedule regeneration via parent callback
      const success = await onRescheduleSchedule();
      if (success) {
        setMessages(prev => [
          ...prev,
          { 
            sender: 'ai', 
            text: "I completely understand. I've re-allocated your remaining afternoon blocks to give you more breathing room and buffers. Take a deep breath—we'll take it one simple step at a time! 🧘" 
          }
        ]);
      } else {
        throw new Error('Reschedule failed');
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: "I tried to optimize your schedule, but something went wrong. Let me try again in a moment!" }
      ]);
    } finally {
      setRescheduling(false);
    }
  };

  const toggleVoiceMode = () => {
    if (!voiceActive) {
      setVoiceActive(true);
      // Simulate listening
      setTimeout(() => {
        setMessages(prev => [
          ...prev, 
          { sender: 'ai', text: "🎙️ (Simulated Voice) I'm listening! You can chat with me or click 'I'm Overwhelmed' to quickly reschedule." }
        ]);
        setVoiceActive(false);
      }, 3000);
    } else {
      setVoiceActive(false);
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '550px', padding: '1.25rem' }}>
      
      {/* Companion Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div 
            style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              background: voiceActive ? 'var(--color-danger)' : 'var(--color-success)',
              boxShadow: voiceActive ? '0 0 10px var(--color-danger)' : '0 0 10px var(--color-success)'
            }} 
          />
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Crunchy AI Co-pilot</span>
        </div>
        
        <button 
          onClick={toggleVoiceMode}
          style={{ 
            background: voiceActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-glass)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
          title={voiceActive ? 'Stop listening' : 'Simulate voice chat'}
        >
          {voiceActive ? '⏹️' : '🎙️'}
        </button>
      </div>

      {/* Voice Wave Visualizer */}
      {voiceActive && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', margin: '0.75rem 0', height: '20px', alignItems: 'center' }}>
          {[1,2,3,4,5,4,3,2,1].map((val, idx) => (
            <div 
              key={idx}
              style={{ 
                width: '3px', 
                height: `${val * 3}px`, 
                background: 'var(--color-primary-light)', 
                borderRadius: '99px',
                animation: 'pulseGlow 1s infinite alternate',
                animationDelay: `${idx * 0.1}s`
              }} 
            />
          ))}
        </div>
      )}

      {/* Messages Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            style={{ 
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: msg.sender === 'user' ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'rgba(255, 255, 255, 0.05)',
              border: msg.sender === 'user' ? 'none' : '1px solid var(--border-glass)',
              borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '0.65rem 0.9rem',
              fontSize: '0.88rem',
              color: 'var(--text-main)',
              lineHeight: 1.4
            }}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Crunchy is thinking... ✍️
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Action Button: Reschedule */}
      <div style={{ marginBottom: '0.75rem' }}>
        <button
          onClick={handleReschedule}
          disabled={rescheduling || loading}
          style={{
            width: '100%',
            background: 'rgba(139, 92, 246, 0.12)',
            color: 'var(--color-primary-light)',
            border: '1px dashed rgba(139, 92, 246, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.6rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
          className="btn-reschedule"
        >
          {rescheduling ? 'Optimizing Schedule...' : '🧘 Feeling Overwhelmed? Reschedule Afternoon'}
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          placeholder="Ask me to break down a step..." 
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          disabled={loading || rescheduling}
          className="input-field"
          style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem' }}
        />
        <button 
          type="submit" 
          disabled={loading || rescheduling}
          className="btn btn-primary"
          style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)' }}
        >
          ➔
        </button>
      </form>
    </div>
  );
}
