import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../utils/helpers';
import { Notification } from '../types';

export const NotificationToast: React.FC<{ notification: Notification; onClose: (id: number) => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 20000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "pointer-events-auto relative overflow-hidden flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border min-w-[320px] max-w-md mb-3",
        notification.type === 'success' 
          ? "bg-white border-blue-100 text-blue-800" 
          : notification.type === 'info'
            ? "bg-white border-slate-100 text-slate-800"
            : "bg-white border-red-100 text-red-800"
      )}
    >
      {notification.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
      ) : notification.type === 'info' ? (
        <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
      )}
      <p className="text-sm font-medium flex-1 leading-snug">{notification.message}</p>
      <button 
        type="button"
        onClick={() => onClose(notification.id)} 
        className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 shrink-0"
        title="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 20-second auto-dismiss progress bar */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 20, ease: 'linear' }}
        className={cn(
          "absolute bottom-0 left-0 h-0.5 opacity-60",
          notification.type === 'success'
            ? "bg-blue-500"
            : notification.type === 'info'
              ? "bg-slate-400"
              : "bg-red-500"
        )}
      />
    </motion.div>
  );
};
