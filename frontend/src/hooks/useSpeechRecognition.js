import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const useSpeechRecognition = ({ onResult, onError, onEnd, language = 'en-US' } = {}) => {
  const [isListening,  setIsListening]  = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const recognitionRef = useRef(null);
  const finalRef       = useRef('');
  const interimRef     = useRef('');
  const isStartingRef  = useRef(false);

  const isSupported = Boolean(SpeechRecognition);

  const stop = useCallback(() => {
    console.log('[useSpeechRecognition] Stopping, finalRef:', finalRef.current, 'interimRef:', interimRef.current);
    isStartingRef.current = false;
    if (recognitionRef.current) {
      if (interimRef.current && !finalRef.current) {
        console.log('[useSpeechRecognition] Sending interim as result:', interimRef.current);
        onResult?.(interimRef.current);
      }
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [onResult]);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      onError?.('Voice input is not supported in this browser. Please use Chrome.');
      return;
    }

    if (isStartingRef.current || recognitionRef.current) {
      console.log('[useSpeechRecognition] Already starting or running, ignoring');
      return;
    }

    isStartingRef.current = true;
    console.log('[useSpeechRecognition] Starting speech recognition...');
    
    setTranscript('');
    finalRef.current   = '';
    interimRef.current = '';

    const rec = new SpeechRecognition();
    rec.lang           = language;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous     = true;

    rec.onstart  = () => {
      console.log('[useSpeechRecognition] ★★★ ONSTART FIRED ★★★');
      isStartingRef.current = false;
      setIsListening(true);
    };

    rec.onsoundstart = () => {
      console.log('[useSpeechRecognition] Sound detected');
    };

    rec.onspeechstart = () => {
      console.log('[useSpeechRecognition] Speech started');
    };

    rec.onspeechend = () => {
      console.log('[useSpeechRecognition] Speech ended');
    };

    rec.onsoundend = () => {
      console.log('[useSpeechRecognition] Sound ended');
    };

    rec.onend = () => {
      console.log('[useSpeechRecognition] Ended, finalRef:', finalRef.current, 'interimRef:', interimRef.current);
      isStartingRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      if (!finalRef.current) {
        if (interimRef.current) {
          console.log('[useSpeechRecognition] Calling onResult with interim from onend:', interimRef.current);
          onResult?.(interimRef.current);
        } else {
          console.log('[useSpeechRecognition] No speech detected, calling onEnd');
          onEnd?.();
        }
      } else {
        console.log('[useSpeechRecognition] Had final result:', finalRef.current);
      }
    };

    rec.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (const result of e.results) {
        if (result.isFinal) final   += result[0].transcript;
        else                interim += result[0].transcript;
      }
      const text = (final || interim).trim();
      console.log('[useSpeechRecognition] onresult - interim:', interim, 'final:', final, 'combined:', text);
      setTranscript(text);
      if (interim) interimRef.current = interim.trim();
      if (final) {
        finalRef.current   = final.trim();
        interimRef.current = '';
        console.log('[useSpeechRecognition] Final result, calling onResult:', final.trim());
        onResult?.(final.trim());
        // Auto-stop after getting final result
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }
    };

    rec.onerror = (e) => {
      console.log('[useSpeechRecognition] Error:', e.error, e);
      isStartingRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      if (e.error === 'not-allowed') {
        onError?.('Microphone access denied. Please allow mic access in your browser settings.');
      } else if (e.error === 'no-speech') {
        onError?.('No speech detected. Please try again.');
      } else if (e.error === 'aborted') {
        console.log('[useSpeechRecognition] Recognition aborted');
      } else {
        onError?.(`Voice error: ${e.error}`);
      }
    };

    try {
      recognitionRef.current = rec;
      console.log('[useSpeechRecognition] Calling rec.start()...');
      rec.start();
      console.log('[useSpeechRecognition] rec.start() returned successfully');
    } catch (err) {
      console.error('SpeechRecognition start error:', err);
      isStartingRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      onError?.('Failed to start voice recognition: ' + err.message);
    }
  }, [onResult, onError, onEnd, language]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { isListening, transcript, isSupported, start, stop };
};

export default useSpeechRecognition;
