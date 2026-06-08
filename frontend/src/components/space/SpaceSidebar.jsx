import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHashtag, faPlus, faVolumeHigh, faTrash, faChevronDown,
  faChevronRight, faXmark, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import api from '../../api/axios';

const SpaceSidebar = ({
  space, channels, activeChannelId, onSelectChannel,
  voiceChannelId, user, onlineMembers = [], collapsed, onToggle,
}) => {
  const [newName,    setNewName]    = useState('');
  const [newType,    setNewType]    = useState('text');
  const [adding,     setAdding]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [textOpen,   setTextOpen]   = useState(true);
  const [voiceOpen,  setVoiceOpen]  = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);

  const textChannels  = channels.filter(c => c.channel_type !== 'voice');
  const voiceChannels = channels.filter(c => c.channel_type === 'voice');

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/spaces/${space.id}/channels`, { name, channel_type: newType });
      setNewName('');
      setAdding(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ch) => {
    setConfirmDel(null);
    try {
      await api.delete(`/spaces/${space.id}/channels/${ch.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Cannot delete');
    }
  };

  const onlineIds = new Set(onlineMembers.map(m => m.user_id));

  return (
    <div className={`flex-shrink-0 bg-white border-r border-gray-100 text-gray-700 flex flex-col h-full transition-all duration-300 shadow-sm ${collapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
      {/* Space header */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
        <div className="min-w-0">
          <p className="font-black text-gray-900 text-sm truncate">{space?.name || 'Community'}</p>
          <p className="text-[10px] text-emerald-600 font-bold truncate">{onlineMembers.length} online</p>
        </div>
        {onToggle && (
          <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-all">
            <FontAwesomeIcon icon={faXmark} className="text-xs" />
          </button>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {channels.length === 0 && (
          <div className="px-4 py-8 text-center animate-fade-in">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FontAwesomeIcon icon={faHashtag} className="text-xl text-gray-400" />
            </div>
            <p className="text-xs font-black text-gray-600 mb-1">No channels yet</p>
            <p className="text-[10px] text-gray-400 mb-4 leading-normal">Create the first channel to start community chats.</p>
            <button
              onClick={() => setAdding(true)}
              className="px-3.5 py-1.5 gradient-green text-white text-[10px] font-black rounded-xl transition-all shadow-sm hover:opacity-90"
            >
              <FontAwesomeIcon icon={faPlus} className="mr-1" /> Create Channel
            </button>
          </div>
        )}

        {/* Text channels */}
        <div className="px-3 mb-1">
          <button
            onClick={() => setTextOpen(v => !v)}
            className="flex items-center gap-1 w-full px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FontAwesomeIcon icon={textOpen ? faChevronDown : faChevronRight} className="text-[8px]" />
            Text Channels
            <span className="ml-auto text-gray-400 font-normal">{textChannels.length}</span>
          </button>

          {textOpen && textChannels.map(ch => (
            <ChannelRow
              key={ch.id} ch={ch} active={ch.id === activeChannelId}
              icon={faHashtag} user={user} confirmDel={confirmDel}
              onSelect={() => onSelectChannel(ch, false)}
              onDeleteRequest={() => setConfirmDel(ch.id)}
              onDeleteConfirm={() => handleDelete(ch)}
              onDeleteCancel={() => setConfirmDel(null)}
            />
          ))}
        </div>

        {/* Add channel */}
        <div className="px-5 mb-2">
          {adding ? (
            <form onSubmit={handleAdd} className="space-y-1.5 mt-1">
              <input
                autoFocus value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="channel-name"
                className="w-full bg-gray-50 text-gray-800 text-xs rounded-xl px-3 py-2 outline-none border-2 border-gray-200 focus:border-emerald-400 transition-colors"
              />
              <div className="flex gap-1">
                {[['text', faHashtag, 'Text'], ['voice', faVolumeHigh, 'Voice']].map(([type, icon, label]) => (
                  <button key={type} type="button"
                    onClick={() => setNewType(type)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-black transition-all border-2 ${newType === type ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <FontAwesomeIcon icon={icon} className="text-[10px]" />{label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button type="submit" disabled={loading || !newName.trim()}
                  className="flex-1 py-1.5 gradient-green text-white text-[10px] font-black rounded-xl disabled:opacity-50 transition-all">
                  {loading ? '...' : 'Create'}
                </button>
                <button type="button" onClick={() => { setAdding(false); setNewName(''); setError(''); }}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl transition-all">
                  <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                </button>
              </div>
              {error && <p className="text-[10px] text-red-500">{error}</p>}
            </form>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-emerald-600 transition-colors font-bold w-full px-2 py-1 mt-1">
              <FontAwesomeIcon icon={faPlus} className="text-[10px]" /> Add Channel
            </button>
          )}
        </div>

        {/* Voice channels */}
        <div className="px-3">
          <button
            onClick={() => setVoiceOpen(v => !v)}
            className="flex items-center gap-1 w-full px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FontAwesomeIcon icon={voiceOpen ? faChevronDown : faChevronRight} className="text-[8px]" />
            Voice Channels
            <span className="ml-auto text-gray-400 font-normal">{voiceChannels.length}</span>
          </button>

          {voiceOpen && voiceChannels.map(ch => (
            <ChannelRow
              key={ch.id} ch={ch} active={ch.id === voiceChannelId}
              icon={faVolumeHigh} user={user} confirmDel={confirmDel}
              onSelect={() => onSelectChannel(ch, true)}
              onDeleteRequest={() => setConfirmDel(ch.id)}
              onDeleteConfirm={() => handleDelete(ch)}
              onDeleteCancel={() => setConfirmDel(null)}
              isVoice
            />
          ))}
        </div>
      </div>

      {/* User bar */}
      <div className="px-3 py-2.5 border-t border-gray-100 flex items-center gap-2 flex-shrink-0 bg-gray-50">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full gradient-green flex items-center justify-center text-white text-xs font-black">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-900 font-bold truncate">{user?.name}</p>
          <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
        </div>
      </div>
    </div>
  );
};

const ChannelRow = ({ ch, active, icon, user, confirmDel, onSelect, onDeleteRequest, onDeleteConfirm, onDeleteCancel, isVoice }) => {
  const canDelete = !ch.is_default && ch.created_by === user?.id;

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between mx-0.5 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${
        active
          ? isVoice
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FontAwesomeIcon icon={icon} className={`text-xs flex-shrink-0 ${active ? 'text-emerald-500' : 'text-gray-400'}`} />
        <span className="text-sm font-semibold truncate">{ch.name}</span>
      </div>

      {confirmDel === ch.id ? (
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onDeleteConfirm} className="text-red-500 hover:text-red-700 transition-colors w-5 h-5 flex items-center justify-center">
            <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
          </button>
          <button onClick={onDeleteCancel} className="text-gray-400 hover:text-gray-600 transition-colors w-5 h-5 flex items-center justify-center">
            <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
          </button>
        </div>
      ) : canDelete ? (
        <button
          onClick={e => { e.stopPropagation(); onDeleteRequest(); }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
        >
          <FontAwesomeIcon icon={faTrash} className="text-[9px]" />
        </button>
      ) : null}
    </div>
  );
};

export default SpaceSidebar;
