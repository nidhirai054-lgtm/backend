import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faXmark, faPaperPlane, faRobot, faCircle } from '@fortawesome/free-solid-svg-icons';

const ChatWidget = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hello! I'm your SmartRide Assistant. How can I help you today?", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { text: userMsg, sender: 'user' }]);
    setIsTyping(true);
    try {
      const res = await api.post('/chat/message', { message: userMsg });
      setMessages(prev => [...prev, { text: res.data.response, sender: 'bot' }]);
    } catch {
      setMessages(prev => [...prev, { text: "Sorry, I'm having trouble connecting right now.", sender: 'bot' }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Don't render on login/register pages
  if (['/login', '/register'].includes(location.pathname)) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}>

      {/* Chat window */}
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '72px', right: 0,
          width: '360px', background: '#fff', borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #f0f0f0',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.25s ease both'
        }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)', padding: '16px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesomeIcon icon={faRobot} />
                </div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>SmartRide Assistant</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <div style={{ width: 6, height: 6, background: '#86efac', borderRadius: '50%' }}></div>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ height: 360, overflowY: 'auto', padding: '16px', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.sender === 'bot' && (
                  <div style={{ width: 28, height: 28, background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0, alignSelf: 'flex-end' }}>
                    <FontAwesomeIcon icon={faRobot} style={{ color: '#10b981', fontSize: 12 }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.sender === 'user' ? 'linear-gradient(135deg,#10b981,#0d9488)' : '#fff',
                  color: msg.sender === 'user' ? '#fff' : '#1f2937',
                  fontSize: 13, lineHeight: 1.5,
                  boxShadow: msg.sender === 'bot' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  border: msg.sender === 'bot' ? '1px solid #f0f0f0' : 'none',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FontAwesomeIcon icon={faRobot} style={{ color: '#10b981', fontSize: 12 }} />
                </div>
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, background: '#d1d5db', borderRadius: '50%', animation: `bounce 1s infinite ${i * 0.15}s` }}></div>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '10px 16px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
            <button type="submit" style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#0d9488)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faPaperPlane} style={{ fontSize: 13 }} />
            </button>
          </form>
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: isOpen ? '#e5e7eb' : 'linear-gradient(135deg,#10b981,#0d9488)',
          color: isOpen ? '#374151' : '#fff',
          boxShadow: '0 8px 30px rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <FontAwesomeIcon icon={isOpen ? faXmark : faComments} />
      </button>

      {/* Unread dot when closed */}
      {!isOpen && (
        <div style={{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, background: '#ef4444', borderRadius: '50%', border: '2px solid #fff' }}></div>
      )}
    </div>
  );
};

export default ChatWidget;
