import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faXmark, faPaperPlane, faRobot, faCircleCheck, faMapLocationDot, faMicrophone, faVolumeHigh, faVolumeXmark, faLanguage } from '@fortawesome/free-solid-svg-icons';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { rideEvents, RIDE_EVENTS } from '../utils/rideEvents';


// Pages where the widget should be hidden entirely
const HIDDEN_ROUTES = ['/login', '/register', '/space'];

// Indian language support
const INDIAN_LANGUAGES = [
  { code: 'en-IN', name: 'English', voice: 'en-IN', flag: '🇮🇳' },
  { code: 'hi-IN', name: 'हिन्दी', voice: 'hi-IN', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'বাংলা', voice: 'bn-IN', flag: '🇮🇳' },
  { code: 'te-IN', name: 'తెలుగు', voice: 'te-IN', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'मराठी', voice: 'mr-IN', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'தமிழ்', voice: 'ta-IN', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'ગુજરાતી', voice: 'gu-IN', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ', voice: 'kn-IN', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'മലയാളം', voice: 'ml-IN', flag: '🇮🇳' },
  { code: 'pa-IN', name: 'ਪੰਜਾਬੀ', voice: 'pa-IN', flag: '🇮🇳' },
  { code: 'or-IN', name: 'ଓଡ଼ିଆ', voice: 'or-IN', flag: '🇮🇳' },
  { code: 'as-IN', name: 'অসমীয়া', voice: 'as-IN', flag: '🇮🇳' },
];

// Quick-reply chips shown on first open
const QUICK_REPLIES = [
  'Book a ride',
  "Where's my driver?",
  'Show green points',
  'Pooled rides',
];

const fmt = (date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Inline keyframe styles injected once
const STYLES = `
@keyframes chatBounce {
  0%, 80%, 100% { transform: translateY(0); }
  40%           { transform: translateY(-6px); }
}
@keyframes chatSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const ChatWidget = () => {
  const location = useLocation();
  const navigate  = useNavigate();

  const [isOpen,   setIsOpen]   = useState(false);
  const [unread,   setUnread]   = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your SmartRide Assistant. How can I help?", sender: 'bot', ts: new Date() },
  ]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [language, setLanguage] = useState('en-IN');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const isPressingRef  = useRef(false);
  const startTimeoutRef = useRef(null);
  
  // Voice integration
  const sendRef = useRef(null);

  const speakText = useCallback(async (text) => {
    if (!voiceMode) {
      console.log('[ChatWidget] Voice mode disabled, skipping TTS');
      return;
    }
    
    console.log('[ChatWidget] Starting TTS for text:', text.substring(0, 50), 'language:', language);
    
    // Cancel any existing speech
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    // Use browser TTS for non-English/Hindi languages (better support for regional Indian languages)
    if (language !== 'en-IN' && language !== 'hi-IN') {
      console.log('[ChatWidget] Using browser TTS for', language);
      
      if (!window.speechSynthesis) {
        console.error('[ChatWidget] Browser TTS not available');
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      const currentLang = INDIAN_LANGUAGES.find(l => l.code === language);
      utterance.lang = currentLang?.voice || 'en-IN';
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      const setVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const targetLang = currentLang?.voice || 'en-IN';
        console.log('[ChatWidget] Available voices:', voices.filter(v => v.lang.startsWith(targetLang.split('-')[0])).map(v => v.name + ' (' + v.lang + ')'));
        
        const preferredVoice = voices.find(v => 
          v.lang === targetLang && (v.name.includes('Google') || v.name.includes('Microsoft'))
        ) || voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log('[ChatWidget] Using browser voice:', preferredVoice.name, preferredVoice.lang);
        } else {
          console.warn('[ChatWidget] No voice found for', targetLang);
        }
      };
      
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoice();
      } else {
        window.speechSynthesis.onvoiceschanged = setVoice;
      }
      
      window._latestUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      return;
    }
    
    // Use cloud TTS for English and Hindi only
    try {
      console.log('[ChatWidget] Calling cloud TTS API...');
      const res = await api.post('/chat/tts', { text, language });
      console.log('[ChatWidget] Cloud TTS response received');
      const { audio_base64 } = res.data;
      
      if (!audio_base64) {
        throw new Error('No audio data received');
      }
      
      const audio = new Audio(`data:audio/mpeg;base64,${audio_base64}`);
      
      audio.onloadeddata = () => {
        console.log('[ChatWidget] Audio loaded, duration:', audio.duration);
      };
      
      audio.onplay = () => {
        console.log('[ChatWidget] Audio playing');
      };
      
      audio.onerror = (e) => {
        console.error('[ChatWidget] Audio playback error:', e);
        throw new Error('Audio playback failed');
      };
      
      await audio.play();
      console.log('[ChatWidget] Playing cloud TTS audio');
    } catch (err) {
      console.error('[ChatWidget] Cloud TTS failed:', err?.response?.data || err.message);
      
      if (!window.speechSynthesis) {
        console.error('[ChatWidget] Browser TTS also not available');
        return;
      }
      
      console.log('[ChatWidget] Falling back to browser TTS');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 0.9;
      window._latestUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, [voiceMode, language]);

  const handleVoiceResult = useCallback((text) => {
    if (text && sendRef.current) sendRef.current(text);
  }, []);

  const handleVoiceError = useCallback((msg) => {
    setMessages(prev => [...prev, { text: msg, sender: 'bot', ts: new Date() }]);
  }, []);

  const { isListening, transcript: voiceTranscript, isSupported, start: startListen, stop: stopListen } =
    useSpeechRecognition({ onResult: handleVoiceResult, onError: handleVoiceError, language });

  useEffect(() => {
    console.log('[ChatWidget] Voice recognition supported:', isSupported);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
      if (isListening) stopListen();
    };
  }, [isListening, stopListen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setUnread(false);
      console.log('[ChatWidget] Chat opened, isSupported:', isSupported, 'isListening:', isListening);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const addBot = (text, extra = {}) => {
    const msg = { text, sender: 'bot', ts: new Date(), ...extra };
    setMessages(prev => [...prev, msg]);
    if (!isOpen) setUnread(true);
  };

  const addUser = (text) =>
    setMessages(prev => [...prev, { text, sender: 'user', ts: new Date() }]);

  const resetSession = async () => {
    try { await api.post('/chat/session/reset'); } catch {}
    setMessages([{ text: "Hi! I'm your SmartRide Assistant. How can I help?", sender: 'bot', ts: new Date() }]);
    setInput('');
  };

  const send = async (text) => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    setInput('');
    addUser(msg);
    setIsLoading(true);
    try {
      const res = await api.post('/chat/message', { message: msg, language });
      const { response, action, booking } = res.data;

      addBot(response);
      await speakText(response);  // Wait for speech to start

      if (action === 'book_ride' && booking?.ride) {
        addBot(
          booking.driver
            ? `Driver ${booking.driver.name} is on the way!`
            : 'Searching for a driver...',
          { rideCard: booking.ride }
        );
        // Emit event to notify other components
        rideEvents.emit(RIDE_EVENTS.RIDE_BOOKED, { ride: booking.ride, driver: booking.driver });
      } else if (action === 'trigger_booking' || action === 'trigger_pool') {
        // Don't close chat, just navigate
        navigate('/');
      } else if (action === 'show_green') {
        // Don't close chat, just navigate
        navigate('/green-rides');
      } else if (action === 'show_status') {
        // Don't close chat, just navigate
        navigate('/my-rides');
      }
    } catch (err) {
      console.error('[ChatWidget] error:', err?.response?.status, err?.response?.data, err);
      addBot("Sorry, I'm having trouble connecting. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { sendRef.current = send; }, [send]);

  const handleSubmit = (e) => { e.preventDefault(); send(input); };

  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  return createPortal(
    <>
      <style>{STYLES}</style>
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999 }}>

        {/* ── Chat window ───────────────────────────────────────────────── */}
        {isOpen && (
          <div style={{
            position: 'absolute', bottom: 72, right: 0,
            width: 'min(360px, calc(100vw - 32px))',
            background: '#fff', borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #f0f0f0',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'chatSlideUp 0.22s ease both',
          }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)', padding: 16, color: '#fff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faRobot} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>SmartRide Assistant</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <div style={{ width: 6, height: 6, background: isLoading ? '#fbbf24' : '#86efac', borderRadius: '50%', transition: 'background 0.3s' }} />
                      <span style={{ fontSize: 11, opacity: 0.85 }}>{isLoading ? 'Thinking...' : 'Online'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowLangMenu(!showLangMenu)}
                      title="Change language"
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesomeIcon icon={faLanguage} />
                    </button>
                    {showLangMenu && (
                      <div style={{ position: 'absolute', top: 35, right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 150, maxHeight: 300, overflowY: 'auto', zIndex: 9999 }}>
                        {INDIAN_LANGUAGES.map(lang => (
                          <button
                            key={lang.code}
                            onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                            style={{ width: '100%', padding: '8px 12px', background: language === lang.code ? '#e0f2fe' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: '#111', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f0f0f0' }}>
                            <span>{lang.flag}</span>
                            <span style={{ fontWeight: language === lang.code ? 700 : 400 }}>{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setVoiceMode(!voiceMode);
                      if (voiceMode) window.speechSynthesis?.cancel();
                    }}
                    title={voiceMode ? "Voice enabled" : "Voice disabled"}
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={voiceMode ? faVolumeHigh : faVolumeXmark} />
                  </button>
                  <button
                    onClick={resetSession}
                    title="New conversation"
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    Reset
                  </button>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ height: 340, overflowY: 'auto', padding: 16, background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
                    {msg.sender === 'bot' && (
                      <div style={{ width: 26, height: 26, background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FontAwesomeIcon icon={faRobot} style={{ color: '#10b981', fontSize: 11 }} />
                      </div>
                    )}
                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{
                        padding: '9px 13px',
                        borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.sender === 'user' ? 'linear-gradient(135deg,#10b981,#0d9488)' : '#fff',
                        color: msg.sender === 'user' ? '#fff' : '#1f2937',
                        fontSize: 13, lineHeight: 1.5,
                        boxShadow: msg.sender === 'bot' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                        border: msg.sender === 'bot' ? '1px solid #f0f0f0' : 'none',
                      }}>
                        {msg.text}
                      </div>

                      {/* Ride confirmation card */}
                      {msg.rideCard && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 13px', fontSize: 12 }}>
                          <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <FontAwesomeIcon icon={faCircleCheck} /> Ride Confirmed
                          </div>
                          <div style={{ color: '#374151', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div>📍 {msg.rideCard.pickup?.address}</div>
                            <div>🏁 {msg.rideCard.dropoff?.address}</div>
                            <div style={{ marginTop: 4, display: 'flex', gap: 10, alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, color: '#111' }}>₹{msg.rideCard.fare}</span>
                              <span style={{ color: '#6b7280' }}>{msg.rideCard.distance_km?.toFixed(1)} km</span>
                              <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', fontSize: 9, padding: '2px 6px', borderRadius: 99 }}>{msg.rideCard.ride_type}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => { navigate('/my-rides'); setIsOpen(false); }}
                            style={{ marginTop: 8, width: '100%', padding: '6px 0', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <FontAwesomeIcon icon={faMapLocationDot} /> Track Ride
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Timestamp */}
                  <span style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, marginLeft: msg.sender === 'bot' ? 34 : 0, marginRight: msg.sender === 'user' ? 0 : 0 }}>
                    {fmt(msg.ts)}
                  </span>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ width: 26, height: 26, background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FontAwesomeIcon icon={faRobot} style={{ color: '#10b981', fontSize: 11 }} />
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, background: '#10b981', borderRadius: '50%',
                        animation: `chatBounce 1s infinite ${i * 0.16}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick replies — shown only when there's just the greeting */}
            {messages.length === 1 && (
              <div style={{ padding: '8px 12px', background: '#f9fafb', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUICK_REPLIES.map(q => (
                  <button key={q} onClick={() => send(q)} disabled={isLoading}
                    style={{ padding: '5px 11px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 99, fontSize: 11, fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <input
                ref={inputRef}
                type="text"
                value={isListening ? voiceTranscript : input}
                onChange={e => setInput(e.target.value)}
                disabled={isLoading || isListening}
                placeholder={isListening ? 'Listening...' : isLoading ? 'Waiting for response...' : 'Type a message...'}
                aria-label="Chat message"
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 999,
                  border: '1px solid #e5e7eb', background: isLoading ? '#f3f4f6' : '#f9fafb',
                  fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.2s',
                }}
              />
              {(!input.trim() && isSupported) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isListening) {
                      console.log('[ChatWidget] Stopping listening');
                      stopListen();
                    } else if (!isLoading) {
                      console.log('[ChatWidget] Starting listening');
                      startListen();
                    }
                  }}
                  disabled={isLoading}
                  title={isListening ? "Click to stop" : "Click to speak"}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isListening ? '#ef4444' : isLoading ? '#e5e7eb' : '#10b981',
                    border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.2s',
                    transform: isListening ? 'scale(1.1)' : 'scale(1)',
                    animation: isListening ? 'pulse 1.5s infinite' : 'none',
                  }}>
                  <FontAwesomeIcon icon={faMicrophone} style={{ fontSize: 14 }} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && !isListening)}
                  aria-label="Send message"
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isLoading || (!input.trim() && !isListening) ? '#e5e7eb' : 'linear-gradient(135deg,#10b981,#0d9488)',
                    border: 'none', cursor: isLoading || (!input.trim() && !isListening) ? 'not-allowed' : 'pointer',
                    color: isLoading || (!input.trim() && !isListening) ? '#9ca3af' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.2s',
                  }}>
                  <FontAwesomeIcon icon={faPaperPlane} style={{ fontSize: 12 }} />
                </button>
              )}
            </form>
          </div>
        )}

        {/* ── Bubble button ─────────────────────────────────────────────── */}
        <button
          onClick={() => setIsOpen(o => !o)}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: isOpen ? '#e5e7eb' : 'linear-gradient(135deg,#10b981,#0d9488)',
            color: isOpen ? '#374151' : '#fff',
            boxShadow: '0 8px 30px rgba(16,185,129,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, transition: 'transform 0.2s, background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <FontAwesomeIcon icon={isOpen ? faXmark : faComments} />
        </button>

        {/* Unread badge — only shown when there's genuinely new bot messages */}
        {!isOpen && unread && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 14, height: 14, background: '#ef4444',
            borderRadius: '50%', border: '2px solid #fff',
            animation: 'chatBounce 1s infinite',
          }} />
        )}
      </div>
    </>,
    document.body
  );
};

export default ChatWidget;
