import React from 'react';
import { Check } from 'lucide-react';

const Toast = ({ message, type = 'success' }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${
          type === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-green-500 text-white'
        }`}
      >
        {type === 'success' && <Check size={20} />}
        <span className="font-semibold">{message}</span>
      </div>
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Toast;
