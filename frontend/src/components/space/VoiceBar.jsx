import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone, faMicrophoneSlash, faPhoneSlash, faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons';

// Renders a hidden <audio> element to play a participant's remote stream
const RemoteAudio = ({ stream }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
};

const VoiceBar = ({ channelName, participants, localUserId, muted, onToggleMute, onLeave }) => (
  <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-2.5 flex items-center gap-3 shadow-sm">
    {/* Hidden audio elements for all remote participants */}
    {participants
      .filter(p => p.user_id !== localUserId && p.stream)
      .map(p => <RemoteAudio key={p.user_id} stream={p.stream} />)
    }

    {/* Status label */}
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="relative w-2 h-2">
        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-60" />
        <div className="w-2 h-2 bg-emerald-400 rounded-full" />
      </div>
      <FontAwesomeIcon icon={faVolumeHigh} className="text-emerald-500 text-xs" />
      <span className="text-xs font-black text-emerald-600 uppercase tracking-wide">Voice</span>
      <span className="text-xs text-gray-400">· #{channelName}</span>
    </div>

    {/* Participants */}
    <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
      {participants.map(p => {
        const isLocal = p.user_id === localUserId;
        const isMuted = isLocal ? muted : p.muted;
        return (
          <div key={p.user_id}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 transition-all ${
              isLocal
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${
              isLocal ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'
            }`}>
              {p.name?.[0]?.toUpperCase()}
            </div>
            <span className="max-w-[64px] truncate">{isLocal ? 'You' : p.name}</span>
            {isMuted && (
              <FontAwesomeIcon icon={faMicrophoneSlash} className="text-red-400 text-[9px] ml-0.5" />
            )}
          </div>
        );
      })}
    </div>

    {/* Controls */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={onToggleMute}
        title={muted ? 'Unmute' : 'Mute'}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${
          muted
            ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
            : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
        }`}>
        <FontAwesomeIcon icon={muted ? faMicrophoneSlash : faMicrophone} className="text-xs" />
      </button>
      <button
        onClick={onLeave}
        title="Disconnect"
        className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 flex items-center justify-center transition-all">
        <FontAwesomeIcon icon={faPhoneSlash} className="text-xs" />
      </button>
    </div>
  </div>
);

export default VoiceBar;
