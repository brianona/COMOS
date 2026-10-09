import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Trash2, X, User as UserIcon, Lock, PenTool, Upload, 
  Check, AlertCircle, RefreshCw, Sparkles, Image as ImageIcon, 
  ShieldCheck, Eraser, CheckCircle2, Shield, Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { getRoleLabel } from '../utils/helpers';

export const ConfirmModal: React.FC<{ 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void; 
}> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[210] overflow-hidden"
          >
            <div className="p-8">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={onCancel}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    onConfirm();
                    onCancel();
                  }}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-100 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  token: string;
  notify: (type: 'success' | 'error', message: string) => void;
  onUpdateUser?: (updated: User) => void;
  initialTab?: 'profile' | 'password';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
  notify,
  onUpdateUser,
  initialTab = 'profile'
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab);
  
  // Profile state
  const [fullName, setFullName] = useState(user.full_name || '');
  const [position, setPosition] = useState(user.position || '');
  const [email, setEmail] = useState(user.email || '');
  const [signatureData, setSignatureData] = useState<string | null>(user.signature_data || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Signature mode (upload or draw)
  const [signatureMode, setSignatureMode] = useState<'upload' | 'draw'>('upload');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnStrokes, setHasDrawnStrokes] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load latest profile info on modal open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFullName(user.full_name || '');
      setPosition(user.position || '');
      setEmail(user.email || '');
      setSignatureData(user.signature_data || null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Fetch fresh profile from server
      if (token) {
        setIsLoadingProfile(true);
        fetch('/api/users/profile', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && !data.error) {
              if (data.full_name !== undefined) setFullName(data.full_name || '');
              if (data.position !== undefined) setPosition(data.position || '');
              if (data.email !== undefined) setEmail(data.email || '');
              if (data.signature_data !== undefined) setSignatureData(data.signature_data || null);
              if (onUpdateUser) {
                onUpdateUser({
                  ...user,
                  full_name: data.full_name || null,
                  position: data.position || null,
                  signature_data: data.signature_data || null,
                  email: data.email || user.email,
                });
              }
            }
          })
          .catch(err => console.warn('Could not fetch user profile:', err))
          .finally(() => setIsLoadingProfile(false));
      }
    }
  }, [isOpen, user.id, token, initialTab]);

  // Handle signature file upload
  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('error', 'Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify('error', 'Signature image size must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Render to canvas to clean & convert to standard PNG data URL
        const canvas = document.createElement('canvas');
        const maxW = 500;
        const maxH = 200;
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        canvas.width = w * ratio;
        canvas.height = h * ratio;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngDataUrl = canvas.toDataURL('image/png');
          setSignatureData(pngDataUrl);
          notify('success', 'Signature image loaded successfully');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawnStrokes(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Slate 900 ink
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSignatureData(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnStrokes(false);
    setSignatureData(null);
  };

  // Save profile updates (Full Name, Position, Signature, Email)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          position: position.trim() || null,
          signature_data: signatureData || null,
          email: email.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('success', 'Profile & Signature updated successfully!');
        if (onUpdateUser) {
          const updatedUser: User = {
            ...user,
            full_name: fullName.trim() || null,
            position: position.trim() || null,
            signature_data: signatureData || null,
            email: email.trim() || user.email,
          };
          onUpdateUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        onClose();
      } else {
        notify('error', data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      notify('error', err.message || 'Connection error while saving profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change password handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notify('error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      notify('error', 'Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('success', 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        notify('error', data.error || 'Failed to change password');
      }
    } catch (err: any) {
      notify('error', err.message || 'Connection error occurred');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-3xl shadow-2xl z-[210] overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header with User Info */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white relative shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-lg font-bold text-white shadow-inner">
                    {user.username[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white leading-tight">
                        {fullName || user.username}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300/80 font-mono mt-0.5">@{user.username}</p>
                  </div>
                </div>

                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 mt-5 bg-white/10 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Profile & Signature</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('password')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'password'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </button>
              </div>
            </div>

            {/* Tab Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {activeTab === 'profile' ? (
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {/* Full Name Input */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                      <span>Full Name (for document stamping)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Printed on stamps & approvals</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Capt. Alexander Wright / John Smith"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Position Input */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                      <span>Position / Job Title</span>
                      <span className="text-[10px] text-slate-400 font-normal">Printed in stamp box</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="e.g. Marine Superintendent / Technical Manager / DPA"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Email Address
                    </label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 outline-none transition-all"
                    />
                  </div>

                  {/* Signature Section */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Digital Signature
                        </label>
                        <p className="text-[11px] text-slate-400">
                          Stamped onto acknowledged documents and orders
                        </p>
                      </div>
                      
                      {/* Signature mode toggle */}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setSignatureMode('upload')}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            signatureMode === 'upload' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Upload className="w-3 h-3 inline mr-1" /> Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignatureMode('draw')}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            signatureMode === 'draw' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <PenTool className="w-3 h-3 inline mr-1" /> Draw
                        </button>
                      </div>
                    </div>

                    {/* Signature Preview or Drawing Canvas */}
                    {signatureMode === 'upload' ? (
                      <div className="space-y-2">
                        {signatureData ? (
                          <div className="relative border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group">
                            <img 
                              src={signatureData} 
                              alt="User Signature" 
                              className="max-h-24 max-w-full object-contain filter drop-shadow-xs"
                            />
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3 py-1 bg-white hover:bg-slate-50 text-blue-600 text-xs font-bold rounded-lg border border-blue-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" /> Change File
                              </button>
                              <button
                                type="button"
                                onClick={() => setSignatureData(null)}
                                className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Upload className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">Click to upload signature image</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">Supports PNG, JPG, WebP, SVG with transparent background</p>
                            </div>
                          </div>
                        )}
                        <input 
                          ref={fileInputRef}
                          type="file" 
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleSignatureFileChange}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      /* Draw on Canvas Pad */
                      <div className="space-y-2">
                        <div className="border border-slate-300 rounded-2xl bg-white p-1 relative shadow-inner overflow-hidden">
                          <canvas
                            ref={canvasRef}
                            width={440}
                            height={140}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-32 bg-slate-50/50 rounded-xl cursor-crosshair touch-none"
                          />
                          {!hasDrawnStrokes && !signatureData && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-medium">
                              Draw your signature here with mouse or touch
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={clearCanvas}
                            className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                          >
                            <Eraser className="w-3.5 h-3.5" /> Clear Pad
                          </button>
                          {signatureData && (
                            <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                              <Check className="w-3.5 h-3.5" /> Signature Captured
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Save Profile & Signature</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Password Change Tab */
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Current Password
                    </label>
                    <input 
                      type="password" 
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      New Password (minimum 6 characters)
                    </label>
                    <input 
                      type="password" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Confirm New Password
                    </label>
                    <input 
                      type="password" 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isChangingPassword}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isChangingPassword ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Backward-compatible ChangePasswordModal component
export const ChangePasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  token: string;
  notify: (type: 'success' | 'error', message: string) => void;
  user?: User;
  onUpdateUser?: (updated: User) => void;
}> = ({ isOpen, onClose, token, notify, user, onUpdateUser }) => {
  const fallbackUser: User = user || {
    id: 0,
    username: 'User',
    role: 'user',
    team_ids: [],
  };

  return (
    <UserProfileModal
      isOpen={isOpen}
      onClose={onClose}
      user={fallbackUser}
      token={token}
      notify={notify}
      onUpdateUser={onUpdateUser}
      initialTab="password"
    />
  );
};
