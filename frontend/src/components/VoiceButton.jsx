import React from 'react';
import useVoice from '../hooks/useVoice';
import api from '../api/axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faSpinner } from '@fortawesome/free-solid-svg-icons';

const VoiceButton = ({ onBookingExtracted }) => {
  const handleFinalTranscript = async (text) => {
    try {
      // Send transcript to backend to extract entities
      const response = await api.post('/voice/process', { transcript: text });
      if (onBookingExtracted) {
        onBookingExtracted(response.data);
      }
    } catch (err) {
      console.error("Voice processing failed", err);
    }
  };

  const { isListening, transcript, startListening, stopListening } = useVoice(handleFinalTranscript);

  return (
    <div className="flex flex-col items-center space-y-3">
      <button
        type="button"
        onMouseDown={startListening}
        onMouseUp={stopListening}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isListening ? 'bg-red-500 scale-110 animate-pulse ring-4 ring-red-200' : 'bg-primary hover:bg-emerald-600 text-white'}`}
      >
        <FontAwesomeIcon icon={isListening ? faSpinner : faMicrophone} className={`text-2xl text-white ${isListening ? 'animate-spin' : ''}`} />
      </button>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {isListening ? 'Listening...' : 'Hold to Speak'}
      </p>
      {transcript && (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 max-w-xs animate-fade-in">
          <p className="text-xs text-gray-600 italic">"{transcript}"</p>
        </div>
      )}
    </div>
  );
};

export default VoiceButton;
