import { useState, useEffect, useCallback } from 'react';

const useVoice = (onTranscript) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-IN'; // Indian English

      rec.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const text = result[0].transcript;
        setTranscript(text);
        if (result.isFinal && onTranscript) {
          onTranscript(text);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, [onTranscript]);

  const startListening = useCallback(() => {
    if (recognition) {
      setTranscript('');
      recognition.start();
      setIsListening(true);
    } else {
      alert("Speech recognition not supported in this browser.");
    }
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition]);

  return { isListening, transcript, startListening, stopListening };
};

export default useVoice;
