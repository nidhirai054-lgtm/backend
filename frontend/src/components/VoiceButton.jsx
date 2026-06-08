import React, { useState, useCallback, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone, faSpinner, faCircleCheck, faCircleXmark,
  faRotateLeft, faLocationDot, faFlag, faCar, faBolt, faBus,
} from '@fortawesome/free-solid-svg-icons';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import api from '../api/axios';

const RIDE_ICONS = { solo: faCar, pooled: faBus, EV: faBolt };

// ── States: idle | listening | processing | confirming | error ───────────────

const VoiceButton = ({ onConfirmed }) => {
  const [phase,    setPhase]    = useState('idle');      // idle | listening | processing | confirming | error
  const [entities, setEntities] = useState(null);        // {pickup, dropoff, ride_type, women_only, understood}
  const [heard,    setHeard]    = useState('');          // raw transcript shown to user
  const [errMsg,   setErrMsg]   = useState('');
  const [processingStatus, setProcessingStatus] = useState('Processing...');

  useEffect(() => {
    if (phase !== 'processing') {
      setProcessingStatus('Processing...');
      return;
    }

    const messages = [
      'Transcribing audio...',
      'Analyzing with Bedrock NLP...',
      'Extracting details...',
      'Almost there...'
    ];
    let index = 0;
    setProcessingStatus(messages[0]);

    const interval = setInterval(() => {
      index = Math.min(index + 1, messages.length - 1);
      setProcessingStatus(messages[index]);
    }, 1200);

    return () => clearInterval(interval);
  }, [phase]);

  const handleResult = useCallback(async (transcript) => {
    setHeard(transcript);
    setPhase('processing');
    try {
      const res = await api.post('/voice/process', { transcript });
      const { entities: ents, ready_to_book } = res.data;
      setEntities(ents);
      setPhase(ready_to_book ? 'confirming' : 'error');
      if (!ready_to_book) {
        setErrMsg(
          !ents?.pickup && !ents?.dropoff
            ? "Couldn't catch your locations. Please try again."
            : !ents?.pickup
            ? "Got the destination but missed the pickup. Try again."
            : "Got the pickup but missed the destination. Try again."
        );
      }
    } catch {
      setPhase('error');
      setErrMsg('Processing failed. Please try again.');
    }
  }, []);

  const handleError = useCallback((msg) => {
    setPhase('error');
    setErrMsg(msg);
  }, []);

  const handleEnd = useCallback(() => {
    // Recognition ended with no speech — reset to idle silently
    setPhase(p => p === 'listening' ? 'idle' : p);
  }, []);

  const { isListening, transcript: liveTranscript, isSupported, start, stop } =
    useSpeechRecognition({ onResult: handleResult, onError: handleError, onEnd: handleEnd });

  // Sync listening phase
  const handlePressStart = () => {
    if (phase !== 'idle') return;
    setPhase('listening');
    setHeard('');
    start();
  };

  const handlePressEnd = () => {
    if (phase !== 'listening') return;
    stop();
    // If no speech was captured, onEnd will reset to idle
    // If speech was captured, onResult will transition to processing
  };

  const reset = () => {
    setPhase('idle');
    setEntities(null);
    setHeard('');
    setErrMsg('');
  };

  const confirm = () => {
    if (!entities) return;
    onConfirmed?.(entities);
    reset();
  };

  // ── Unsupported browser ──────────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div className="text-center px-3 py-2 bg-amber-50 border border-amber-200 rounded-2xl">
        <p className="text-xs text-amber-700 font-bold">Voice booking requires Chrome or Edge</p>
      </div>
    );
  }

  // ── Confirming state ─────────────────────────────────────────────────────
  if (phase === 'confirming' && entities) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 flex items-center gap-2">
          <FontAwesomeIcon icon={faMicrophone} className="text-white text-xs" />
          <span className="text-white text-xs font-black uppercase tracking-wide">Confirm Voice Booking</span>
        </div>

        {/* Heard transcript */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">You said</p>
          <p className="text-xs text-gray-600 italic bg-gray-50 rounded-xl px-3 py-2">"{heard}"</p>
        </div>

        {/* Extracted entities */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <FontAwesomeIcon icon={faLocationDot} className="text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Pickup</p>
              <p className="text-sm font-bold text-gray-800">{entities.pickup}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FontAwesomeIcon icon={faFlag} className="text-red-400 text-xs mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Dropoff</p>
              <p className="text-sm font-bold text-gray-800">{entities.dropoff}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
              <FontAwesomeIcon icon={RIDE_ICONS[entities.ride_type] || faCar} className="text-emerald-500" />
              {entities.ride_type}
            </span>
            {entities.women_only && (
              <span className="text-xs font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">
                Women-only
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={confirm}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <FontAwesomeIcon icon={faCircleCheck} /> Book this ride
          </button>
          <button
            onClick={reset}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all"
          >
            <FontAwesomeIcon icon={faRotateLeft} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="w-full bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3 animate-fade-in">
        <FontAwesomeIcon icon={faCircleXmark} className="text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-700">{errMsg}</p>
          {heard && <p className="text-[10px] text-red-400 mt-0.5 italic truncate">Heard: "{heard}"</p>}
        </div>
        <button onClick={reset} className="text-xs font-black text-red-500 hover:text-red-700 flex-shrink-0">
          Try again
        </button>
      </div>
    );
  }

  // ── Idle / listening / processing ────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <button
        type="button"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={(e) => { e.preventDefault(); handlePressStart(); }}
        onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
        disabled={phase === 'processing'}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg select-none
          ${phase === 'listening'
            ? 'bg-red-500 scale-110 ring-4 ring-red-200'
            : phase === 'processing'
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95'
          }`}
      >
        <FontAwesomeIcon
          icon={phase === 'processing' ? faSpinner : faMicrophone}
          className={`text-2xl text-white ${phase === 'processing' ? 'animate-spin' : ''}`}
        />
      </button>

      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {phase === 'listening'  ? 'Listening... release to process' :
         phase === 'processing' ? processingStatus :
         'Hold to speak'}
      </p>

      {/* Live interim transcript while listening */}
      {phase === 'listening' && liveTranscript && (
        <p className="text-xs text-gray-500 italic text-center max-w-[240px] animate-fade-in">
          "{liveTranscript}"
        </p>
      )}
    </div>
  );
};

export default VoiceButton;
