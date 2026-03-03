import React from 'react';
import { Check } from 'lucide-react';

const Toast = ({ message, type = 'success' }) => {
  if (!message) return null;

  return (
    <div className="app-toast-shell">
      <div className={`app-toast-card ${type === 'error' ? 'is-error' : 'is-success'}`}>
        {type === 'success' && <Check size={20} />}
        <span className="font-semibold">{message}</span>
      </div>
    </div>
  );
};

export default Toast;
