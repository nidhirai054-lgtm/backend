import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import RideProposalCard from './RideProposalCard';

const MessageBubble = ({ message, user, proposal, proposalActions, onDelete, grouped, onFetchProposal }) => {
  const [hovered, setHovered] = useState(false);
  const isOwn    = message.sender_id === user?.id;
  const isSystem = message.message_type === 'system';
  const canDelete = isOwn || user?.role === 'admin';

  // Fetch proposal from backend if message references one but it's not in local state yet
  React.useEffect(() => {
    if (message.message_type === 'ride_proposal' && message.ride_proposal_id && !proposal) {
      onFetchProposal?.(message.ride_proposal_id);
    }
  }, [message.message_type, message.ride_proposal_id, proposal, onFetchProposal]);

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">
          {message.content}
        </span>
      </div>
    );
  }

  if (message.message_type === 'ride_proposal' && message.ride_proposal_id) {
    if (!proposal) {
      return (
        <div className="my-2 px-1">
          <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      );
    }
    return (
      <div className="my-2">
        {!grouped && (
          <div className="text-[11px] text-gray-400 mb-1.5 px-1">
            <span className="font-bold text-gray-600">{message.sender_name}</span>
            {' · '}
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        <RideProposalCard proposal={proposal} user={user} actions={proposalActions} />
      </div>
    );
  }

  return (
    <div
      className={`group flex gap-2.5 px-2 py-0.5 rounded-xl transition-colors hover:bg-gray-100/60 ${isOwn ? 'flex-row-reverse' : ''} ${grouped ? 'mt-0' : 'mt-3'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar — only show on first of a group */}
      <div className="w-8 flex-shrink-0 flex flex-col items-center">
        {!grouped ? (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${
            isOwn
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
              : 'bg-gradient-to-br from-sky-400 to-blue-500'
          }`}>
            {message.sender_name?.[0]?.toUpperCase()}
          </div>
        ) : (
          <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 select-none w-full text-center">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
        {/* Name + time (only first in group) */}
        {!grouped && (
          <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-bold text-gray-700">{isOwn ? 'You' : message.sender_name}</span>
            <span className="text-[10px] text-gray-400">
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        <div className="relative">
          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            message.deleted
              ? 'italic text-gray-400 bg-transparent border border-gray-200'
              : isOwn
              ? 'bg-emerald-500 text-white rounded-tr-sm shadow-sm'
              : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100 shadow-sm'
          }`}>
            {message.deleted ? 'Message deleted' : message.content}
          </div>

          {/* Hover action */}
          {hovered && !message.deleted && canDelete && (
            <button
              onClick={() => onDelete?.(message.id)}
              className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? '-left-8' : '-right-8'} w-7 h-7 flex items-center justify-center bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-500 rounded-lg transition-all shadow-sm`}
            >
              <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
