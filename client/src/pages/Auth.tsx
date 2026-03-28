import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Lock, Mail, User, Eye, EyeOff, Phone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function ResetPasswordForm({ resetData, resetPassword, resendCode, onBackToLogin }: any) {
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return "Password must be at least 8 characters long";
    if (!/[A-Z]/.test(pwd)) return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Password must contain a lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must contain a number";
    if (!/[^A-Za-z0-9]/.test(pwd)) return "Password must contain a symbol";
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-[var(--brand)]/10 rounded-full blur-2xl animate-pulse" />
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground relative z-10">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-[var(--brand)]" fill="currentColor" fillOpacity="0.1" />
            <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="currentColor" strokeWidth="1" />
            <path d="M15 3.5l1.5-1.5M9 3.5L7.5 2" stroke="currentColor" strokeWidth="1.5" className="text-[var(--brand)] animate-pulse" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold font-display">Reset Password</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Enter the 6-digit code sent to <strong>{resetData.email}</strong> and your new password.
        </p>
      </div>

      <form onSubmit={(e) => { 
        e.preventDefault(); 
        if (password !== confirmPassword) return toast.error("Passwords do not match");
        const passwordError = validatePassword(password);
        if (passwordError) return toast.error(passwordError);
        resetPassword.mutate({ token: resetData.token, code: otpCode, newPassword: password }); 
      }} className="space-y-6">
        
        <div className="space-y-2 text-center">
          <Label htmlFor="resetOtpCode">Reset Code</Label>
          <div className="relative flex justify-center gap-2 mt-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-12 h-14 border-2 rounded-lg flex items-center justify-center text-2xl font-bold font-mono transition-all ${
                  otpCode.length === i ? "border-[var(--brand)] ring-4 ring-[var(--brand)]/20" : otpCode.length > i ? "border-foreground" : "border-border bg-muted/30"
                }`}
              >
                {otpCode[i] || ""}
              </div>
            ))}
            <input id="resetOtpCode" className="absolute inset-0 w-full h-full opacity-0 cursor-text" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus autoComplete="one-time-code" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="newPassword" type={showPassword ? "text" : "password"} required placeholder="••••••••" className="pl-10 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="confirmNewPassword" type={showPassword ? "text" : "password"} required placeholder="••••••••" className="pl-10 pr-10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
        </div>
        <Button type="submit" className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11" disabled={otpCode.length !== 6}>Update Password</Button>
      </form>
      
      <div className="text-center mt-6 space-y-4">
        {resendTimer > 0 ? (
          <p className="text-sm text-muted-foreground">Resend code in <span className="font-medium text-foreground">{resendTimer}s</span></p>
        ) : (
          <button type="button" onClick={() => { resendCode.mutate({ email: resetData.email }); setResendTimer(60); }} className="text-sm font-medium text-[var(--brand)] hover:underline" disabled={resendCode.isPending}>Resend Code</button>
        )}
        <div>
          <button type="button" onClick={onBackToLogin} className="text-sm text-muted-foreground hover:underline">← Back to Login</button>
        </div>
      </div>
    </div>
  );
}

function VerifyEmailForm({ verificationData, verifyEmail, resendVerification, onBackToLogin }: any) {
  const [otpCode, setOtpCode] = useState("");
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-[var(--brand)]/10 rounded-full blur-2xl animate-pulse" />
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground relative z-10">
            <path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--brand)]" fill="currentColor" fillOpacity="0.05" />
            <circle cx="18" cy="19" r="4.5" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
            <path d="M18 17v4m-2-2h4" className="text-[var(--brand)]" strokeWidth="1.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold font-display">Check your email</h1>
        <p className="text-muted-foreground text-sm mt-2">
          We've sent a 6-digit verification code to <strong>{verificationData.email}</strong>.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); verifyEmail.mutate({ token: verificationData.token, code: otpCode }); }} className="space-y-6">
        <div className="space-y-2 text-center">
          <Label htmlFor="otpCode">Verification Code</Label>
          <div className="relative flex justify-center gap-2 mt-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-12 h-14 border-2 rounded-lg flex items-center justify-center text-2xl font-bold font-mono transition-all ${
                  otpCode.length === i ? "border-[var(--brand)] ring-4 ring-[var(--brand)]/20" : otpCode.length > i ? "border-foreground" : "border-border bg-muted/30"
                }`}
              >
                {otpCode[i] || ""}
              </div>
            ))}
            <input id="otpCode" className="absolute inset-0 w-full h-full opacity-0 cursor-text" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus autoComplete="one-time-code" />
          </div>
        </div>
        <Button type="submit" className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11" disabled={verifyEmail.isPending || otpCode.length !== 6}>
          Verify Account
        </Button>
      </form>
      
      <div className="text-center mt-6 space-y-4">
        {resendTimer > 0 ? (
          <p className="text-sm text-muted-foreground">Resend code in <span className="font-medium text-foreground">{resendTimer}s</span></p>
        ) : (
          <button type="button" onClick={() => { resendVerification.mutate({ email: verificationData.email }); setResendTimer(60); }} className="text-sm font-medium text-[var(--brand)] hover:underline" disabled={resendVerification.isPending}>Resend Code</button>
        )}
        <div>
          <button type="button" onClick={onBackToLogin} className="text-sm text-muted-foreground hover:underline">← Back to Login</button>
        </div>
      </div>
    </div>
  );
}

export default function Auth() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const redirectUrl = params.get("redirect") || "/dashboard";
  const oauthError = params.get("error");
  const mode = params.get("mode");
  const prefillEmail = params.get("email") || "";
  const claimOrderNumber = params.get("claimOrder") || undefined;

  const [isLogin, setIsLogin] = useState(mode !== "register");
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  useEffect(() => {
    if (oauthError === "google_not_configured") {
      toast.error("Google Login is not configured yet. Please use email/password.", {
        id: "oauth-error", // prevent duplicate toasts
      });
    } else if (oauthError === "facebook_not_configured") {
      toast.error("Facebook Login is not configured yet. Please use email/password.", {
        id: "oauth-error-fb",
      });
    }
  }, [oauthError]);

  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<{ token: string; email: string } | null>(null);
  const [resetData, setResetData] = useState<{ token: string; email: string } | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);
  const [form, setForm] = useState({ 
    firstName: "", 
    lastName: "", 
    surname: "",
    phone: "",
    email: prefillEmail, 
    password: "", 
    confirmPassword: "", 
    acceptTerms: false, 
    rememberMe: false 
  });
  const utils = trpc.useUtils();

  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Successfully logged in");
      window.dispatchEvent(new Event("userAuthChanged"));
      navigate(redirectUrl, { replace: true });
    },
    onError: (err) => {
      toast.error(err.message);
      if (err.message.toLowerCase().includes("verify your email")) {
        setUnverifiedEmail(form.email);
      }
    },
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success("Account created! Please check your email for the verification code.");
      setVerificationData({ token: data.token, email: data.email });
      setForm(prev => ({ ...prev, password: "", confirmPassword: "" }));
    },
    onError: (err) => toast.error(err.message),
  });

  const forgotPassword = trpc.auth.resetPasswordRequest.useMutation({
    onSuccess: (data) => {
      toast.success("Password reset code sent to your email!");
      setResetData({ token: data.token, email: data.email });
      setIsForgotPassword(false);
      setForm({ ...form, email: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated successfully! Please sign in.");
      setResetData(null);
      setForm({ ...form, password: "", confirmPassword: "" });
      setIsLogin(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const resendVerification = trpc.auth.resendVerification.useMutation({
    onSuccess: (data) => {
      toast.success("Verification email resent! Please check your inbox.");
      setUnverifiedEmail(null);
      setVerificationData({ token: data.token, email: data.email });
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyEmail = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      toast.success("Email verified successfully! You can now sign in.");
      setVerificationData(null);
      setIsLogin(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const validatePassword = (password: string) => {
    if (password.length < 8) return "Password must be at least 8 characters long";
    if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain a number";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a symbol";
    return null;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length === 0) return "";
    const cc = numbers.slice(0, 1);
    const area = numbers.slice(1, 4);
    const prefix = numbers.slice(4, 7);
    const line = numbers.slice(7, 11);
    let res = `+${cc}`;
    if (numbers.length > 1) res += ` (${area}`;
    if (numbers.length > 4) res += `) ${prefix}`;
    if (numbers.length > 7) res += `-${line}`;
    return res;
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^\+\d{1,3}\s\(\d{3}\)\s\d{3}-\d{4}$/;
    if (!phoneRegex.test(phone)) return "Phone number must follow the format: +1 (555) 123-4567";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isForgotPassword) {
      forgotPassword.mutate({ email: form.email });
    } else if (isLogin) {
      login.mutate({ email: form.email, password: form.password });
    } else {
      if (form.password !== form.confirmPassword) {
        return toast.error("Passwords do not match");
      }
      const passwordError = validatePassword(form.password);
      if (passwordError) return toast.error(passwordError);

      const phoneError = validatePhone(form.phone);
      if (phoneError) return toast.error(phoneError);

      if (!form.acceptTerms) {
        return toast.error("Please accept the Terms & Conditions");
      }

      const fullName = [form.firstName, form.lastName, form.surname].filter(Boolean).join(" ");
      register.mutate({ name: fullName, email: form.email, password: form.password, phone: form.phone, claimOrderNumber } as any);
    }
  };

  const isPending = login.isPending || register.isPending || forgotPassword.isPending || resetPassword.isPending || resendVerification.isPending || verifyEmail.isPending;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Navbar />
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md p-8 shadow-xl bg-card border-border relative overflow-hidden">
          {/* Generic Loading Overlay */}
          {isPending && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-[var(--brand)] mb-4" />
              <p className="text-sm font-medium text-muted-foreground animate-pulse">Please wait...</p>
            </div>
          )}

          {resetData ? (
            <ResetPasswordForm 
              resetData={resetData} 
              resetPassword={resetPassword} 
              resendCode={forgotPassword} 
              onBackToLogin={() => { setResetData(null); setIsLogin(true); }} 
            />
          ) : verificationData ? (
            <VerifyEmailForm 
              verificationData={verificationData} 
              verifyEmail={verifyEmail} 
              resendVerification={resendVerification} 
              onBackToLogin={() => { setVerificationData(null); setIsLogin(true); }} 
            />
          ) : (
            <>
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-[var(--brand)]" />
            </div>
            <h1 className="text-2xl font-bold font-display">
              {isForgotPassword ? "Forgot Password" : isLogin ? "Welcome Back" : "Create an Account"}
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              {isForgotPassword ? "We'll send you a code to reset it" : isLogin ? "Sign in to your account to continue" : "Join us to track orders and save your details"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="firstName" required placeholder="First Name" className="pl-10" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="lastName" required placeholder="Last Name" className="pl-10" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Surname (Optional)</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="surname" placeholder="Surname" className="pl-10" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
            
            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" required placeholder="+1 (555) 123-4567" className="pl-10" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" required placeholder="name@company.com" className="pl-10" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} required placeholder="••••••••" className="pl-10 pr-10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            )}

            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="confirmPassword" type={showPassword ? "text" : "password"} required placeholder="••••••••" className="pl-10 pr-10" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
                </div>
              </div>
            )}

            {!isLogin && !isForgotPassword && (
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="terms" className="rounded border-input w-4 h-4 text-[var(--brand)] focus:ring-[var(--brand)]" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} required />
                <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground cursor-pointer">
                  I agree to the <a href="/legal/terms-of-service" className="text-[var(--brand)] hover:underline">Terms &amp; Conditions</a>
                </Label>
              </div>
            )}

            {isLogin && !isForgotPassword && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="remember" className="rounded border-input w-4 h-4 text-[var(--brand)] focus:ring-[var(--brand)]" checked={form.rememberMe} onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })} />
                  <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">Remember Me</Label>
                </div>
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm font-medium text-[var(--brand)] hover:underline">
                  Forgot Password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full bg-[var(--brand)] text-white hover:opacity-90 mt-6 h-11" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isForgotPassword ? "Send Reset Code" : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {unverifiedEmail && isLogin && !isForgotPassword && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border text-center space-y-3">
              <p className="text-sm text-muted-foreground">Didn't receive the verification email?</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resendVerification.isPending}
                onClick={() => resendVerification.mutate({ email: unverifiedEmail })}
              >
                <Mail className="w-4 h-4 mr-2" /> Resend Verification Code
              </Button>
            </div>
          )}

          {!isForgotPassword && (
            <div className="mt-6">
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-card px-3 text-muted-foreground font-medium">OR</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-11 font-medium bg-background hover:bg-muted" 
                  disabled={!!oauthLoading}
                  onClick={() => { setOauthLoading("google"); window.location.href = "/api/auth/google"; }}
                >
                  {oauthLoading === "google" ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : (
                    <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Continue with Google
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-11 font-medium bg-background hover:bg-muted" 
                  disabled={!!oauthLoading}
                  onClick={() => { setOauthLoading("facebook"); window.location.href = "/api/auth/facebook"; }}
                >
                  {oauthLoading === "facebook" ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : (
                    <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  )}
                  Continue with Facebook
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            {isForgotPassword ? (
              <button type="button" onClick={() => { setIsForgotPassword(false); setUnverifiedEmail(null); }} className="text-sm text-[var(--brand)] hover:underline">
                ← Back to Login
              </button>
            ) : (
              <button type="button" onClick={() => { setIsLogin(!isLogin); setUnverifiedEmail(null); }} className="text-sm text-[var(--brand)] hover:underline">
                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
            )}
          </div>
            </>
          )}
        </Card>
      </div>
      <Footer />
    </div>
  );
}