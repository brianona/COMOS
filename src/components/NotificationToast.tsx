import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../utils/helpers';
import { Notification } from '../types';

export const NotificationToast: React.FC<{ notification: Notification; onClose: (id: number) => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border min-w-[300px] mb-3",
        notification.type === 'success' 
          ? "bg-white border-blue-100 text-blue-800" 
          : notification.type === 'info'
            ? "bg-white border-slate-100 text-slate-800"
            : "bg-white border-red-100 text-red-800"
      )}
    >
      {notification.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-blue-500" />
      ) : notification.type === 'info' ? (
        <AlertCircle className="w-5 h-5 text-slate-400" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500" />
      )}
      <p className="text-sm font-medium flex-1">{notification.message}</p>
      <button onClick={() => onClose(notification.id)} className="p-1 hover:bg-blue-50 rounded-lg transition-colors">
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </motion.div>
  );
};
