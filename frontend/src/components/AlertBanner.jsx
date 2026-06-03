import React, { useEffect, useState } from 'react';
import useSocket from '../hooks/useSocket';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';

const AlertBanner = () => {
  const { on, off } = useSocket();
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    on('safety_alert', (data) => {
      setAlert(data);
      // Auto-hide after 10 seconds
      setTimeout(() => setAlert(null), 10000);
    });

    return () => off('safety_alert');
  }, [on, off]);

  if (!alert) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-lg px-4 animate-bounce-in">
      <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-white/20 backdrop-blur-lg">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <FontAwesomeIcon icon={faTriangleExclamation} className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="font-black text-lg leading-tight">SAFETY ALERT</h4>
            <p className="text-xs font-bold opacity-90">{alert.alert_type}: {alert.driver_name} deviated from route!</p>
          </div>
        </div>
        <button 
          onClick={() => setAlert(null)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default AlertBanner;
