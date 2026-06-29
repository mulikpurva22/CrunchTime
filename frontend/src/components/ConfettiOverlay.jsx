import React, { useEffect, useState } from 'react';

export default function ConfettiOverlay({ isOpen, onClose }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    // Generate confetti particles
    const colors = ['#8b5cf6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
    const newParticles = Array.from({ length: 90 }).map((_, i) => {
      const size = Math.random() * 8 + 6; // 6px to 14px
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100; // 0% to 100% of viewport width
      const delay = Math.random() * 0.4; // 0s to 0.4s delay
      const duration = Math.random() * 2 + 1.5; // 1.5s to 3.5s fall duration
      const rotation = Math.random() * 360;
      
      return {
        id: i,
        style: {
          position: 'absolute',
          top: '-20px',
          left: `${left}vw`,
          width: `${size}px`,
          height: `${size * 1.6}px`,
          backgroundColor: color,
          borderRadius: '2px',
          transform: `rotate(${rotation}deg)`,
          animationName: 'confettiFall',
          animationDuration: `${duration}s`,
          animationTimingFunction: 'linear',
          animationDelay: `${delay}s`,
          animationFillMode: 'forwards',
          zIndex: 5001
        }
      };
    });

    setParticles(newParticles);

    // Auto close after 3.8 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3800);

    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(9, 9, 11, 0.94)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5000,
      animation: 'fadeInOverlay 0.3s ease forwards',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes confettiFall {
          0% {
            top: -20px;
            transform: translateY(0) rotate(0deg);
          }
          100% {
            top: 105vh;
            transform: translateY(0) rotate(720deg);
          }
        }
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes congratsPulse {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* Confetti Particles Container */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {particles.map(p => (
          <div key={p.id} style={p.style} />
        ))}
      </div>

      {/* Congratulatory Card */}
      <div style={{
        textAlign: 'center',
        zIndex: 5002,
        animation: 'congratsPulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '2rem'
      }}>
        <div style={{ fontSize: '4.5rem', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.35))' }}>🎉</div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '3.6rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-success), var(--color-secondary-light))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
          letterSpacing: '-0.02em'
        }}>
          CONGRATULATIONS!
        </h1>
        <p style={{
          fontSize: '1.2rem',
          color: 'var(--text-muted)',
          maxWidth: '520px',
          marginTop: '0.25rem',
          lineHeight: 1.5
        }}>
          You completed a task block! Your productivity momentum is climbing. Keep crunching those goals! 🚀
        </p>
        <button 
          onClick={onClose} 
          className="btn btn-primary" 
          style={{ marginTop: '1.5rem', padding: '0.65rem 1.8rem', borderRadius: '99px' }}
        >
          Awesome, Next Task!
        </button>
      </div>
    </div>
  );
}
