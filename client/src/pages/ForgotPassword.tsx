import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { OTPInput } from 'input-otp';

export function ForgotPassword({ onBackToLogin }: { onBackToLogin: () => void }) {
  // Check for email in URL params
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const emailFromUrl = urlParams.get('email') || '';
  const tokenFromUrl = urlParams.get('token') || '';
  
  const [step, setStep] = useState<1 | 2>(() => {
    // If we have token and email in URL, start at step 2 (OTP entry)
    return (tokenFromUrl && emailFromUrl) ? 2 : 1;
  });
  const [email, setEmail] = useState(emailFromUrl);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tokenData, setTokenData] = useState(tokenFromUrl);

  const requestResetMutation = trpc.auth.resetPasswordRequest.useMutation({
    onSuccess: (data) => {
      setStep(2);
      setTokenData(data.token);
      setError('');
      setSuccessMsg('A 6-digit PIN has been sent to your email address.');
    },
    onError: (err) => setError(err.message)
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccessMsg('Password has been successfully reset! You can now log in.');
      setError('');
      setTimeout(() => onBackToLogin(), 3000); // Send them back to login after 3s
    },
    onError: (err) => setError(err.message)
  });

  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    requestResetMutation.mutate({ email });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('Please enter the full 6-digit PIN.');
      return;
    }
    // Use token from URL if available, otherwise use token from mutation
    const token = tokenData || requestResetMutation.data?.token || '';
    if (!token) {
      setError('Session expired. Please request a new password reset.');
      return;
    }
    resetPasswordMutation.mutate({
      token,
      code: otp,
      newPassword: newPassword
    });
  };

  return (
    <div className="max-w-md w-full mx-auto p-8 bg-white rounded-xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Reset Password</h2>

      {error && <div className="mb-5 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">{error}</div>}
      {successMsg && <div className="mb-5 p-3 bg-green-50 text-green-700 rounded-md text-sm border border-green-100">{successMsg}</div>}

      {step === 1 && (
        <form onSubmit={handleRequestReset} className="space-y-5">
          <p className="text-sm text-gray-600">Enter your account email address and we'll send you a secure 6-digit PIN to reset your password.</p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="manager@store.com"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Press Enter to submit</p>
          </div>
          
          <button 
            type="submit" 
            disabled={requestResetMutation.isPending}
            className="w-full bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-4 rounded-md disabled:opacity-70 transition-colors"
          >
            {requestResetMutation.isPending ? 'Sending...' : 'Send Reset PIN'}
          </button>

          <button type="button" onClick={onBackToLogin} className="w-full text-sm text-gray-500 hover:text-gray-900 text-center mt-4">
            Remembered your password? Back to login
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleResetPassword} className="space-y-6">
           <button 
            type="button" 
            onClick={() => setStep(1)} 
            className="text-sm text-blue-600 flex items-center hover:underline mb-2"
          >
            <ArrowLeft size={14} className="mr-1" /> Back to Email
          </button>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter 6-digit PIN</label>
            <OTPInput 
              maxLength={6} 
              value={otp}
              onChange={setOtp}
              render={({ slots }) => (
                <div className="flex justify-between gap-2">
                  {slots.map((slot, idx) => (
                    <div 
                      key={idx} 
                      className={`w-12 h-14 border rounded-md flex items-center justify-center text-xl font-bold transition-all ${slot.isActive ? 'border-blue-500 ring-2 ring-blue-100 z-10' : 'border-gray-300 bg-gray-50'}`}
                    >
                      {slot.char}
                      {slot.hasFakeCaret && <div className="w-px h-6 bg-blue-500 animate-pulse" />}
                    </div>
                  ))}
                </div>
              )} 
            />
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Press Enter to submit</p>
          </div>

          <button 
            type="submit" 
            disabled={resetPasswordMutation.isPending || resetPasswordMutation.isSuccess}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md disabled:opacity-70 transition-colors"
          >
            {resetPasswordMutation.isPending ? 'Resetting Securely...' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  );
}