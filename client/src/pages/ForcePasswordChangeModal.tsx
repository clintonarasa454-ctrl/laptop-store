import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Lock, AlertTriangle } from 'lucide-react';

export function ForcePasswordChangeModal({ 
  isOpen, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onSuccess: () => void; 
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      onSuccess(); // Close modal and proceed to dashboard
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-amber-600">
          <AlertTriangle size={26} />
          <h2 className="text-xl font-bold text-gray-900">Password Change Required</h2>
        </div>
        <p className="text-gray-600 mb-6 text-sm">
          For security reasons, you must change your system-generated temporary password before accessing the manager portal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current (Temporary) Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter the password from your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Retype new password"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={changePasswordMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors disabled:opacity-70 mt-2"
          >
            {changePasswordMutation.isPending ? 'Updating Securely...' : 'Update Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}