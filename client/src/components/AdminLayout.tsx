import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/pages/useAuth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SettingsResponse } from "@shared/settingsTypes";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  TrendingUp,
  Tag,
  Layers,
  UserCircle,
  Lock,
  Mail,
  User,
  Loader2,
  Eye,
  EyeOff,
  ShieldAlert,
  Car,
  Truck,
  Store,
  Sparkles,
  RotateCcw,
  Mic,
  Volume2,
  VolumeX,
  Bell,
  Upload,
  MessageCircle,
  Camera,
  Scale
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AdminSearch } from "@/components/AdminSearch";
import { trpc } from "@/lib/trpc";
import { useAIWorkflow, RecordedAction } from "@/contexts/AIWorkflowContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ForcePasswordChangeModal } from "@/pages/ForcePasswordChangeModal";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { StaffChatModal } from "@/components/StaffChatModal";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

export default function AdminLayout({ children, activeTab = "dashboard" }: AdminLayoutProps) {
  const { user, logout, loading } = useAuth();
  const isDev = import.meta.env.MODE !== "production";
  const [locationPath, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
  });

  // --- 15-Minute Idle Logout for Managers ---
  useEffect(() => {
    if (!user || user.role !== "manager") return;

    let idleTimer: NodeJS.Timeout;
    let lastResetTime = Date.now();

    const setTimer = () => {
      idleTimer = setTimeout(() => {
        logout();
        toast.error("Session expired due to 15 minutes of inactivity.");
        setLocation("/");
      }, 15 * 60 * 1000);
    };

    const resetIdleTimer = () => {
      const now = Date.now();
      // Throttle timer resets to at most once every 30 seconds to prevent severe UI lag
      if (now - lastResetTime > 30000) {
        clearTimeout(idleTimer);
        setTimer();
        lastResetTime = now;
      }
    };

    setTimer();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']; // Removed mousemove to save CPU
    events.forEach(e => document.addEventListener(e, resetIdleTimer, { passive: true }));

    return () => {
      clearTimeout(idleTimer);
      events.forEach(e => document.removeEventListener(e, resetIdleTimer));
    };
  }, [user, logout, setLocation]);

  // --- Check for password reset token in URL ---
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const hasResetToken = params.has('token') || params.has('code') || params.has('email');
  const isResetMode = params.get('reset') === 'true';

  // --- Settings & Store Info ---
  const { data: settingsData } = trpc.settings.public.useQuery(
    { keys: ["appearance", "general", "ai"] },
    { staleTime: 5 * 60 * 1000 } // Cache settings for 5 minutes to prevent duplicate hits
  );
  const settings = settingsData as any;
  const storeName = settings?.general?.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem("store_name_cache") : null) || "Admin";
  const logoUrl = settings?.appearance?.logoUrl ?? (typeof localStorage !== 'undefined' ? localStorage.getItem("store_logo_cache") : null);
  const isAiEnabled = settings?.ai?.enabled !== false;

  // --- AI Assistant Hooks ---
  const [aiChatOpen, setAiChatOpen] = useState(() => {
    try { return sessionStorage.getItem("store_admin_ai_open") === "true"; } catch { return false; }
  });
  const [isStaffChatOpen, setIsStaffChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string, suggestions?: string[] }[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const chatPositionRef = useRef({ x: 0, y: 0 });
  const chatWidgetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { logAction } = useAIWorkflow();

  const { data: unreadStaffCount } = trpc.staffChat.getUnreadCount.useQuery(undefined, {
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 3000, // Auto-refresh every 3 seconds for snappier updates
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: !!user && (user.role === "admin" || user.role === "manager"),
  });

  // --- Notifications Sync ---
  const { data: notifications } = trpc.admin.notifications.useQuery(undefined, {
    staleTime: 0, // Data is immediately stale for real-time updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: !!user && (user.role === "admin" || user.role === "manager"),
  });
  const [readIds, setReadIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("admin_read_notifications") || "[]"); } catch { return []; }
  });
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("admin_dismissed_notifications") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        setReadIds(JSON.parse(localStorage.getItem("admin_read_notifications") || "[]"));
        setDismissedIds(JSON.parse(localStorage.getItem("admin_dismissed_notifications") || "[]"));
      } catch { }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('admin_notifications_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('admin_notifications_updated', handleStorage);
    };
  }, []);

  const unreadCount = useMemo(() => (notifications || []).filter((n: any) => !dismissedIds.includes(n.id) && !readIds.includes(n.id)).length, [notifications, dismissedIds, readIds]);

  // Voice Search State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isMuted, setIsMuted] = useState(true);

  const speakResponse = (text: string) => {
    if (isMuted || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current && typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join("");
          setChatInput(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }

    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    else { if (recognitionRef.current) { recognitionRef.current.start(); setIsListening(true); toast.info("Listening..."); } else { toast.error("Voice input is not supported in your browser."); } }
  };

  const executeCommands = (commands: RecordedAction[]) => {
    if (!commands || commands.length === 0) return;

    toast.info(`Starting workflow execution...`);

    commands.forEach((command, index) => {
      // Stagger execution to make it observable
      setTimeout(() => {
        toast(`Step ${index + 1}: ${command.description}`);
        if (command.type === 'navigate') {
          setLocation(command.payload.path);
        } else if (command.type === 'click') {
          const el = document.querySelector(command.payload.selector) as HTMLElement;
          if (el) el.click();
          else toast.error(`Action failed: Could not find ${command.payload.selector}`);
        }
      }, (index + 1) * 1500); // 1.5s delay between steps
    });
  };

  const aiMutation = trpc.ai.adminChat.useMutation({
    onSuccess: (data) => {
      setChatMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, content: data.reply }];
        return next as { role: "user" | "assistant"; content: string }[];
      });
      if (data.suggestions && data.suggestions.length > 0) setDynamicSuggestions(data.suggestions);
      speakResponse(data.reply);
      if (data.commands && data.commands.length > 0) {
        executeCommands(data.commands as RecordedAction[]);
      }
    },
    onError: (error) => {
      let errorMessage = "Sorry, I ran into a network error. Please try again.";
      if (error.message.includes('quota') || error.message.includes('429')) {
        errorMessage = "The AI is currently unavailable due to high traffic or billing issues. Please check your plan and billing details, then try again later.";
      }
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: errorMessage }] as { role: "user" | "assistant"; content: string }[]);
    }
  });

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, aiChatOpen]);

  useEffect(() => { sessionStorage.setItem("store_admin_ai_open", String(aiChatOpen)); }, [aiChatOpen]);
  useEffect(() => { sessionStorage.setItem("store_admin_ai_messages", JSON.stringify(chatMessages)); }, [chatMessages]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("store_admin_ai_position");
      if (saved) chatPositionRef.current = JSON.parse(saved);
    } catch { }
  }, []);

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || aiMutation.isPending) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages: { role: 'user' | 'assistant', content: string, suggestions?: string[] }[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(newMessages);
    setDynamicSuggestions([]);
    aiMutation.mutate({ message: userMsg, history: newMessages.slice(1) });
  };

  const handleNewChat = () => {
    const displayName = user?.name || "Admin";
    setChatMessages([{ role: 'assistant', content: `Hello, welcome to the ${user?.role === 'manager' ? 'Manager portal' : 'Admin panel'}. I'm here to help you manage your store efficiently. How can I assist you today?` }]);
    setChatInput("");
    toast.success("New chat started!");
  };

  const adminSuggestedPrompts = [
    "Summarize today's revenue",
    "Are there any low stock items?",
    "Show pending orders",
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    if (aiMutation.isPending) return;
    const newMessages: { role: 'user' | 'assistant', content: string, suggestions?: string[] }[] = [...chatMessages, { role: 'user', content: prompt }];
    setChatMessages(newMessages);
    setDynamicSuggestions([]);
    aiMutation.mutate({ message: prompt, history: newMessages.slice(1) });
  };

  const renderMessageContent = (content: string) => {
    const linkParts = content.split(/\[([^\]]+)\]\(([^)]+)\)/g);
    const elements = [];
    for (let i = 0; i < linkParts.length; i += 3) {
      const textPart = linkParts[i];
      const boldParts = textPart.split(/(\*\*.*?\*\*)/g);
      boldParts.forEach((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          elements.push(<strong key={`bold-${i}-${j}`}>{part.slice(2, -2)}</strong>);
        } else if (part) {
          const lines = part.split('\n');
          lines.forEach((line, k) => {
            elements.push(<span key={`text-${i}-${j}-${k}`}>{line}</span>);
            if (k < lines.length - 1) elements.push(<br key={`br-${i}-${j}-${k}`} />);
          });
        }
      });
      if (i + 1 < linkParts.length) {
        elements.push(<Link key={`link-${i}`} href={linkParts[i + 2]} onClick={() => { setAiChatOpen(false); window.speechSynthesis?.cancel(); }} className="text-[var(--brand)] hover:underline font-semibold transition-colors">{linkParts[i + 1]}</Link>);
      }
    }
    return elements;
  };

  useEffect(() => {
    if (user) {
      setProfileForm(prev => {
        const name = user.name || "";
        const email = user.email || "";
        if (prev.name === name && prev.email === email) return prev;
        return { ...prev, name, email };
      });
      // Initialize AI chat
      const saved = sessionStorage.getItem("store_admin_ai_messages");
      if (saved) {
        try { setChatMessages(JSON.parse(saved)); } catch { }
      } else {
        setChatMessages([{ role: 'assistant', content: `Hello, welcome to the ${user?.role === 'manager' ? 'Manager portal' : 'Admin panel'}. I'm here to help you manage your store efficiently. How can I assist you today?` }]);
      }
    }
  }, [user, storeName]);

  // --- Complete Profile Logic (Photo ID) ---
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();
  
  const updatePhotoMutation = trpc.auth.updateProfilePhoto.useMutation({
    onSuccess: () => {
      toast.success("Profile completed successfully!");
      setShowCompleteProfile(false);
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    // If the user is a manager, hasn't uploaded a photo, and isn't currently forced to change their password
    if (user && user.role === 'manager' && !user.photoId && !user.requiresPasswordChange) {
      setShowCompleteProfile(true);
    }
  }, [user]);

  const updateProfileMutation = trpc.auth.updateAdminProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      setShowEditProfile(false);
      setProfileForm(prev => ({ ...prev, currentPassword: "", newPassword: "" }));
    },
    onError: (err: any) => toast.error(err.message || "Failed to update profile"),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileToCrop(file);
    e.target.value = '';
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.newPassword && !profileForm.currentPassword) {
      return toast.error("Current password is required to set a new password.");
    }
    if (!profileForm.currentPassword) {
      return toast.error("Please enter your current password to authorize changes.");
    }
    
    // If photo was selected in Edit Profile, upload it first
    if (profilePhotoFile) {
      setIsUploadingPhoto(true);
      try {
        const presignedUrl = await createPresignedUrl.mutateAsync({ filename: profilePhotoFile.name, contentType: profilePhotoFile.type });
        if (presignedUrl.uploadUrl) {
          await fetch(presignedUrl.uploadUrl, { method: "PUT", headers: { "Content-Type": profilePhotoFile.type }, body: profilePhotoFile });
          await updatePhotoMutation.mutateAsync({ photoId: presignedUrl.publicUrl || "" });
        }
      } catch (err) { toast.error("Failed to upload new photo"); }
      setIsUploadingPhoto(false);
    }
    
    updateProfileMutation.mutate(profileForm);
  };

  const [adminLoginForm, setAdminLoginForm] = useState({ email: "", password: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(() => {
    // Auto-show password reset form if token is present in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.has('token') || params.has('code');
    }
    return false;
  });
  const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);

  // --- 5-Minute Manager Login Timeout Redirect (but allow password reset) ---
  useEffect(() => {
    if (!user && !loading && locationPath.startsWith('/manager') && !hasResetToken && !isResetMode && !showForcePasswordChange) {
      const loginTimeout = setTimeout(() => {
        toast.warning("Login time expired. Redirecting to storefront.");
        setLocation("/");
      }, 5 * 60 * 1000);
      return () => clearTimeout(loginTimeout);
    }
  }, [user, loading, locationPath, setLocation, hasResetToken, isResetMode, showForcePasswordChange]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success("Login successful");
      if (data.requiresPasswordChange) {
        setShowForcePasswordChange(true);
      } else {
        window.location.reload();
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ ...adminLoginForm, isAdminLogin: true });
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilePhotoFile) return toast.error("Please select a Photo ID to upload.");
    setIsUploadingPhoto(true);
    try {
      const presignedUrl = await createPresignedUrl.mutateAsync({
        filename: profilePhotoFile.name,
        contentType: profilePhotoFile.type,
      });
      if (presignedUrl.uploadUrl) {
        await fetch(presignedUrl.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": profilePhotoFile.type },
          body: profilePhotoFile,
        });
        updatePhotoMutation.mutate({ photoId: presignedUrl.publicUrl || "" });
      }
    } catch (err) {
      toast.error("Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (!user) {
    const isManagerLogin = locationPath.startsWith('/manager');

    return (
      <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${
        isManagerLogin 
          ? "bg-slate-950" 
          : "bg-gradient-to-br from-background via-background to-[var(--brand)]/10"
      }`}>
        {/* Background Decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {isManagerLogin ? (
            <>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-blue-600/10 blur-[100px]" />
              <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] rounded-full bg-indigo-500/10 blur-[100px]" />
            </>
          ) : (
            <>
              <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--brand)]/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-[var(--brand)]/10 blur-3xl" />
            </>
          )}
        </div>

        <ForcePasswordChangeModal 
          isOpen={showForcePasswordChange} 
          onSuccess={() => window.location.reload()} 
        />

        {showCompleteProfile && !showForcePasswordChange && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md shadow-2xl border-border overflow-hidden">
              <form onSubmit={handleCompleteProfile} className="flex flex-col">
                <div className="p-6 bg-muted/40 border-b border-border">
                  <h3 className="text-xl font-bold font-display">Complete Your Profile</h3>
                  <p className="text-xs text-muted-foreground mt-1">Please upload your Photo ID to access your dashboard.</p>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-medium mb-3">Upload Photo ID *</label>
                  <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-lg hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 transition-colors">
                      <Camera size={28} className="text-muted-foreground opacity-50" />
                      <span className="text-sm font-medium text-muted-foreground text-center">Take Selfie</span>
                      <input type="file" accept="image/*" capture="user" onChange={handleFileSelect} className="hidden" id="profile-selfie-upload" required={!profilePhotoFile} />
                    </label>
                    <label className="flex-1 cursor-pointer flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-lg hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 transition-colors">
                      <Upload size={28} className="text-muted-foreground opacity-50" />
                      <span className="text-sm font-medium text-muted-foreground text-center">Choose File</span>
                      <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="profile-photo-upload" required={!profilePhotoFile} />
                    </label>
                  </div>
                  {profilePhotoFile && <p className="text-sm text-center text-[var(--brand)] font-medium mt-3">Selected: {profilePhotoFile.name}</p>}
                </div>
                <div className="p-6 bg-muted/40 border-t border-border flex justify-end">
                  <Button type="submit" className="bg-[var(--brand)] text-white hover:opacity-90 w-full" disabled={updatePhotoMutation.isPending || isUploadingPhoto || !profilePhotoFile}>
                    {(updatePhotoMutation.isPending || isUploadingPhoto) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Upload & Continue"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showForgotPassword ? (
          <div className="relative z-10 w-full max-w-md">
            <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />
          </div>
        ) : (
          <Card className={`w-full max-w-md p-8 shadow-2xl backdrop-blur-xl text-center relative z-10 ${
            isManagerLogin 
              ? "bg-slate-900/80 border-slate-800 text-slate-50 shadow-blue-900/20" 
              : "bg-card/80 border-border/50"
          }`}>
            {logoUrl && !isManagerLogin ? (
              <img src={logoUrl} alt={storeName} className="h-12 object-contain mx-auto mb-6" />
            ) : (
              <div className={`w-12 h-12 flex items-center justify-center mx-auto mb-5 ${
                isManagerLogin 
                  ? "rounded-2xl bg-blue-600/20 border border-blue-500/30" 
                  : "rounded-full bg-[var(--brand)]/10"
              }`}>
                {isManagerLogin ? <Users className="w-6 h-6 text-blue-400" /> : <Lock className="w-6 h-6 text-[var(--brand)]" />}
              </div>
            )}
            <h1 className="text-2xl font-bold font-display mb-1">
              {isManagerLogin ? 'Manager Portal' : 'Admin Panel'}
            </h1>
            <p className={`text-sm mb-6 ${isManagerLogin ? "text-slate-400" : "text-muted-foreground"}`}>
              {isManagerLogin ? "Sign in to manage store operations" : "Sign in to access system settings"}
            </p>

            <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className={`absolute left-3 top-3 h-4 w-4 ${isManagerLogin ? "text-slate-400" : "text-muted-foreground"}`} />
                  <Input 
                    type="text" 
                    aria-label="Email or Phone" 
                    required 
                    placeholder="Enter email or phone" 
                    className={`pl-10 ${isManagerLogin ? "bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500" : ""}`} 
                    value={adminLoginForm.email} 
                    onChange={(e) => setAdminLoginForm({ ...adminLoginForm, email: e.target.value })} 
                    disabled={loginMutation.isPending} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className={`absolute left-3 top-3 h-4 w-4 ${isManagerLogin ? "text-slate-400" : "text-muted-foreground"}`} />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    aria-label="Password" 
                    required 
                    placeholder="Enter password" 
                    className={`pl-10 pr-10 ${isManagerLogin ? "bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500" : ""}`} 
                    value={adminLoginForm.password} 
                    onChange={(e) => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })} 
                    disabled={loginMutation.isPending} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-2.5 transition-colors ${isManagerLogin ? "text-slate-400 hover:text-slate-200" : "text-muted-foreground hover:text-foreground"}`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={loginMutation.isPending}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-end pt-1">
                <button type="button" onClick={() => setShowForgotPassword(true)} className={`text-sm font-medium hover:underline ${isManagerLogin ? "text-blue-400" : "text-[var(--brand)]"}`}>
                  Forgot Password?
                </button>
              </div>

              <Button type="submit" className={`w-full mt-4 h-11 shadow-sm ${isManagerLogin ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-[var(--brand)] text-white hover:opacity-90"}`} disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Login
              </Button>
            </form>

            <div className="mt-6">
              <button type="button" onClick={() => setLocation("/")} className={`text-sm hover:underline ${isManagerLogin ? "text-slate-400 hover:text-slate-300" : "text-muted-foreground"}`}>
                ← Back to Store
              </button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Guard: Strictly ONLY admins and managers can access the admin panel.
  if (user && user.role !== "admin" && user.role !== "manager") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-[var(--brand)]/10 p-4 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--brand)]/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        </div>

        <Card className="w-full max-w-md p-8 shadow-2xl bg-card/80 backdrop-blur-xl border-border/50 text-center relative z-10">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-12 object-contain mx-auto mb-6" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
          )}
          <h1 className="text-2xl font-bold font-display mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You are currently logged in with a standard customer account and do not have permission to access this portal.</p>
          <div className="space-y-3">
            <Button onClick={() => logout()} variant="outline" className="w-full h-11 border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white">
              Sign Out & Switch Account
            </Button>
            <Button onClick={() => setLocation("/")} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 h-11">
              Return to Storefront
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Guard: Prevent Admin from accessing Manager portal and vice versa
  if (user && user.role === "manager" && locationPath.startsWith("/admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-[var(--brand)]/10 p-4 relative overflow-hidden">
        <Card className="w-full max-w-md p-8 shadow-2xl bg-card/80 backdrop-blur-xl border-border/50 text-center relative z-10">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold font-display mb-2">Unauthorized Route</h1>
          <p className="text-muted-foreground mb-8">You are logged in as a Manager. Please use the Manager Portal instead of the Admin Panel.</p>
          <Button onClick={() => setLocation("/manager")} className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11">
            Go to Manager Portal
          </Button>
        </Card>
      </div>
    );
  }

  if (user && user.role === "admin" && locationPath.startsWith("/manager")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-[var(--brand)]/10 p-4 relative overflow-hidden">
        <Card className="w-full max-w-md p-8 shadow-2xl bg-card/80 backdrop-blur-xl border-border/50 text-center relative z-10">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold font-display mb-2">Unauthorized Route</h1>
          <p className="text-muted-foreground mb-8">You are logged in as an Admin. Please use the Admin Panel instead of the Manager Portal.</p>
          <Button onClick={() => setLocation("/admin")} className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11">
            Go to Admin Panel
          </Button>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to securely sign out. Please try again.");
    }
  };

  const displayName = user?.name || user?.email || (isDev ? "Dev Admin" : "User");

  const basePath = user?.role === "manager" ? "/manager" : "/admin";

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: basePath },
    { id: "analytics", label: "Analytics", icon: TrendingUp, href: `${basePath}/analytics` },
    { id: "products", label: "Products", icon: Package, href: `${basePath}/products` },
    { id: "brands", label: "Brands", icon: Tag, href: `${basePath}/brands` },
    { id: "categories", label: "Categories", icon: Layers, href: `${basePath}/categories` },
    { id: "orders", label: "Orders", icon: ShoppingCart, href: `${basePath}/orders` },
    { id: "payments", label: "Payments", icon: CreditCard, href: `${basePath}/payments` },
    { id: "users", label: "Users", icon: Users, href: `${basePath}/users` },
    { id: "content", label: "Content", icon: FileText, href: `${basePath}/content` },
    { id: "warehouses", label: "Warehouses", icon: Store, href: `${basePath}/warehouses` },
    { id: "notifications", label: "Notifications", icon: Bell, href: `${basePath}/notifications` },
    ...(user?.role === "admin" ? [
      { id: "appeals", label: "Appeals", icon: Scale, href: `${basePath}/appeals` },
      { id: "ai", label: "AI Settings", icon: Sparkles, href: `${basePath}/ai` },
      { id: "settings", label: "Settings", icon: Settings, href: `${basePath}/settings` },
    ] : []),
  ];

  // Index of payments item to insert fleet management after it
  const paymentsIndex = navItems.findIndex(item => item.id === "payments");

  const fleetNavItems = [
    { id: "vehicles", label: "Vehicles", href: `${basePath}/vehicles` },
    { id: "drivers", label: "Drivers", href: `${basePath}/drivers` },
    { id: "assignments", label: "Assignments", href: `${basePath}/assignments` },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-[70] md:z-0 h-full ${
          sidebarOpen ? "translate-x-0 w-[80%] max-w-[16rem]" : "-translate-x-full md:translate-x-0 md:w-20"
        } bg-card border-r border-border transition-transform md:transition-all duration-300 flex flex-col overflow-hidden shadow-2xl md:shadow-none`}
      >
        {/* Logo Area */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2 truncate pr-2">
              {logoUrl && (
                <img src={logoUrl} alt={storeName} className="h-8 max-w-[140px] object-contain" />
              )}
              <h2 className="text-lg font-bold text-primary truncate">{user?.role === 'manager' ? 'Manager Portal' : 'Admin Panel'}</h2>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-secondary rounded-lg transition-colors"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div key={item.id}>
                <button
                  onClick={() => {
                    logAction({ type: 'navigate', payload: { path: item.href }, description: `Navigated to ${item.label} page` });
                    setLocation(item.href);
                    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                    ? "bg-[var(--brand)]/10 text-[var(--brand)] font-bold shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    }`}
                  title={sidebarOpen ? "" : item.label}
                >
                  {isActive && <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-[var(--brand)] rounded-r-full" />}
                  <Icon size={20} className={`flex-shrink-0 ${isActive ? "scale-110" : ""}`} />
                  {sidebarOpen && <span>{item.label}</span>}
                  {item.id === "notifications" && unreadCount > 0 && sidebarOpen && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  {item.id === "notifications" && unreadCount > 0 && !sidebarOpen && (
                    <span className="absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground shadow-sm">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Render Fleet Management after Payments */}
                {item.id === "payments" && (
                  <Collapsible>
                    <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-all duration-200">
                      <Truck size={20} />
                      {sidebarOpen && <span>Fleet Management</span>}
                    </CollapsibleTrigger>
                    <CollapsibleContent className={`pl-8 space-y-1 py-1 ${sidebarOpen ? 'block' : 'hidden'}`}>
                      {fleetNavItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                          <Link 
                            key={item.id} 
                            href={item.href} 
                            onClick={() => { if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false); }}
                            className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${isActive ? 'bg-[var(--brand)]/10 text-[var(--brand)] font-semibold' : 'hover:bg-muted'
                            }`}>
                            {item.label}
                          </Link>
                        )
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            );
          })}

        </nav>

        {/* Divider */}
        <div className="border-t border-border"></div>

        {/* User Info & Actions */}
        <div className="p-4 space-y-2">
          {sidebarOpen && (
            <div className="px-3 py-2.5 bg-secondary/50 rounded-lg mb-3 border border-border/50 flex items-center gap-3">
              {user?.photoId ? (
                <img src={user.photoId} alt={displayName} className="w-9 h-9 rounded-full object-cover border border-border shadow-sm shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                  <span className="font-semibold text-[var(--brand)]">{displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{user?.role === 'manager' ? 'Manager Profile' : 'Admin Profile'}</p>
                <p className="text-sm font-medium truncate text-foreground">{displayName}</p>
              </div>
            </div>
          )}

          <Button
            id="edit-profile-btn"
            onClick={() => {
              logAction({ type: 'click', payload: { selector: '#edit-profile-btn' }, description: "Opened 'Edit Profile' modal" });
              setShowEditProfile(true);
            }}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <UserCircle size={16} />
            {sidebarOpen && "Edit Profile"}
          </Button>

          <Button
            id="sign-out-btn"
            onClick={() => {
              logAction({ type: 'click', payload: { selector: '#sign-out-btn' }, description: "Clicked 'Sign Out' button" });
              handleLogout();
            }}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut size={16} />
            {sidebarOpen && "Sign Out"}
          </Button>

          <Button
            onClick={() => {
              logAction({ type: 'navigate', payload: { path: '/' }, description: "Navigated back to the main store" });
              setLocation("/");
            }}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown size={16} className="rotate-90" />
            {sidebarOpen && "Back to Store"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1 hover:bg-secondary rounded-lg transition-colors shrink-0"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {navItems.find((item) => item.id === activeTab)?.label || (user?.role === 'manager' ? "Manager Portal" : "Admin Panel")}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <AdminSearch />
            <Button variant="ghost" size="icon" className="relative" onClick={() => setIsStaffChatOpen(!isStaffChatOpen)} title="Staff Chat">
              <MessageCircle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
              {unreadStaffCount && unreadStaffCount > 0 ? (
                <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground shadow-sm">
                  {unreadStaffCount > 9 ? '9+' : unreadStaffCount}
                </span>
              ) : null}
            </Button>
            {isAiEnabled && (
              <Button variant="ghost" size="icon" onClick={() => setAiChatOpen(!aiChatOpen)} title="Toggle AI Assistant">
                <Sparkles className="w-5 h-5 text-[var(--brand)]" />
              </Button>
            )}
            <div className="text-sm text-muted-foreground hidden md:block">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="p-8 flex-1">{children}</div>
          <footer className="border-t border-border bg-card mt-auto shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link href="/legal/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                <Link href="/legal/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
                <Link href="/legal/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-border overflow-hidden">
            <form onSubmit={handleProfileSubmit} className="flex flex-col">
              <div className="p-6 bg-muted/40 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold font-display">My Profile</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage your personal information and security.</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-muted shrink-0" onClick={() => setAiChatOpen(false)} aria-label="Close chat">
                  <X size={16} />
                </Button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <UserCircle size={16} className="text-primary" /> Personal Information
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label htmlFor="profile-name" className="text-xs font-medium text-muted-foreground">Full Name</label>
                      <Input id="profile-name" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} required placeholder="e.g. Jane Doe" className="bg-background" disabled={updateProfileMutation?.isPending} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="profile-email" className="text-xs font-medium text-muted-foreground">Email Address</label>
                      <Input id="profile-email" type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} required placeholder="admin@example.com" className="bg-background" disabled={updateProfileMutation?.isPending} />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs font-medium text-muted-foreground">Profile Photo ID</label>
                    <div className="flex items-center gap-3">
                      {(user?.photoId || profilePhotoFile) && (
                        <img src={profilePhotoFile ? URL.createObjectURL(profilePhotoFile) : user?.photoId} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-border" />
                      )}
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1.5 text-xs border border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white px-3 py-1.5 rounded-md cursor-pointer transition-colors">
                          <Camera size={14} /> Selfie <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileSelect} />
                        </label>
                        <label className="flex items-center gap-1.5 text-xs border border-border bg-secondary hover:bg-muted px-3 py-1.5 rounded-md cursor-pointer transition-colors">
                          <Upload size={14} /> Gallery <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
                    <Lock size={16} className="text-primary" /> Security Settings
                  </h4>
                  <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 space-y-3">
                    <div className="space-y-1.5">
                      <label htmlFor="profile-current-password" className="text-xs font-medium text-muted-foreground">Current Password</label>
                      <Input id="profile-current-password" type="password" placeholder="Required to save any changes" value={profileForm.currentPassword} onChange={e => setProfileForm({ ...profileForm, currentPassword: e.target.value })} className="bg-background" required disabled={updateProfileMutation?.isPending} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="profile-new-password" className="text-xs font-medium text-muted-foreground">New Password</label>
                      <Input id="profile-new-password" type="password" placeholder="Leave blank to keep current password" value={profileForm.newPassword} onChange={e => setProfileForm({ ...profileForm, newPassword: e.target.value })} className="bg-background" disabled={updateProfileMutation?.isPending} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-muted/40 border-t border-border flex justify-end gap-3">
                <Button id="cancel-profile-btn" type="button" variant="outline" onClick={() => {
                  logAction({ type: 'click', payload: { selector: '#cancel-profile-btn' }, description: "Closed 'Edit Profile' modal" });
                  setShowEditProfile(false);
                }} disabled={updateProfileMutation?.isPending}>Cancel</Button>
                <Button id="save-profile-btn" onClick={() => logAction({ type: 'click', payload: { selector: '#save-profile-btn' }, description: "Clicked 'Save Changes' on Profile" })} type="submit" className="bg-primary text-primary-foreground hover:opacity-90 min-w-[120px]" disabled={updateProfileMutation?.isPending}>
                  {updateProfileMutation?.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <StaffChatModal isOpen={isStaffChatOpen} onClose={() => setIsStaffChatOpen(false)} />

      {/* Floating AI Chat Card */}
      {isAiEnabled && aiChatOpen && (
        <div
          ref={chatWidgetRef}
          className="fixed bottom-6 right-6 z-[100] transition-opacity duration-300 opacity-100 chat-widget"
          style={{ "--chat-x": `${chatPositionRef.current.x}px`, "--chat-y": `${chatPositionRef.current.y}px` } as React.CSSProperties}
        >
          <div className="w-80 sm:w-96 h-[32rem] bg-card border border-border shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`px-5 py-4 border-b border-border/50 bg-gradient-to-r from-[var(--brand)]/8 to-[var(--brand)]/4 flex items-center justify-between select-none touch-none flex-shrink-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                setIsDragging(true);
                dragStartRef.current = { x: e.clientX - chatPositionRef.current.x, y: e.clientY - chatPositionRef.current.y };
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!isDragging) return;
                const newX = e.clientX - dragStartRef.current.x;
                const newY = e.clientY - dragStartRef.current.y;
                chatPositionRef.current = { x: newX, y: newY };
                if (chatWidgetRef.current) {
                  chatWidgetRef.current.style.setProperty('--chat-x', `${newX}px`);
                  chatWidgetRef.current.style.setProperty('--chat-y', `${newY}px`);
                }
              }}
              onPointerUp={(e) => {
                setIsDragging(false);
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                sessionStorage.setItem("store_admin_ai_position", JSON.stringify(chatPositionRef.current));
              }}
            >
              <div className="flex items-center gap-2.5 pointer-events-none">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/20 text-[var(--brand)] flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-[0.95rem]">{user?.role === 'manager' ? 'Manager Portal' : 'Admin Panel'}</h3>
                  <p className="text-[0.7rem] text-muted-foreground font-medium">System Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-foreground transition-colors" onClick={handleNewChat} title="New Chat" aria-label="New Chat">
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setIsMuted(!isMuted); if (!isMuted) window.speechSynthesis?.cancel(); }} title={isMuted ? "Unmute AI Voice" : "Mute AI Voice"} aria-label="Toggle Voice">
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" onClick={() => { setAiChatOpen(false); window.speechSynthesis?.cancel(); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gradient-to-b from-background/50 to-background" ref={chatScrollRef}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 flex-shrink-0`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === 'user'
                    ? 'rounded-2xl rounded-tr-md bg-[var(--brand)] text-white shadow-md'
                    : 'rounded-2xl rounded-tl-md bg-muted text-foreground shadow-sm'
                    } px-4 py-3 break-words whitespace-normal`}>
                    <div className={`text-xs leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'font-medium' : 'font-normal'}`}>
                      {msg.role === 'assistant' ? (
                        renderMessageContent(msg.content)
                      ) : msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant' && !aiMutation.isPending && (
                <div className="flex flex-col gap-2 mt-2 flex-shrink-0 animate-in fade-in duration-300">
                  <p className="text-[0.75rem] text-muted-foreground font-semibold uppercase tracking-wider px-1">Suggested for you</p>
                  <div className="flex flex-wrap gap-2">
                    {(dynamicSuggestions.length > 0 ? dynamicSuggestions : adminSuggestedPrompts).map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => handleSuggestedPrompt(prompt)}
                        className="text-xs bg-background hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-[var(--brand)] border border-border/50 hover:border-[var(--brand)]/30 rounded-full px-3 py-1.5 transition-all duration-200 text-left shadow-none hover:shadow-sm flex-shrink-0"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMutation.isPending && (
                <div className="flex justify-start animate-in fade-in duration-300 flex-shrink-0">
                  <div className="bg-muted rounded-2xl rounded-tl-md p-3 flex items-center gap-2 h-11 px-4 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-border/50 bg-background/80 backdrop-blur-sm flex-shrink-0">
              <form className="flex gap-2" onSubmit={handleAiSubmit}>
                <div className="relative flex-1">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} aria-label="Chat input" placeholder={isListening ? "Listening..." : "Ask about orders, products..."} className="w-full h-10 pl-3.5 pr-9 text-xs rounded-lg border border-input/60 bg-background hover:border-input focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 focus:border-[var(--brand)] transition-all placeholder:text-muted-foreground/50" disabled={aiMutation.isPending} />
                  <button type="button" onClick={toggleListening} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors p-1 rounded hover:bg-muted/50 ${isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-foreground'}`} title="Voice Search" disabled={aiMutation.isPending} aria-label="Voice Search" aria-pressed={isListening}>
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <Button type="submit" size="sm" className="bg-[var(--brand)] text-white hover:opacity-90 h-10 px-4 rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={!chatInput.trim() || aiMutation.isPending}>Send</Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Simple Image Cropper Modal */}
      {fileToCrop && (
        <ImageCropperModal
          file={fileToCrop}
          onCrop={(file) => {
            setProfilePhotoFile(file);
            setFileToCrop(null);
          }}
          onCancel={() => setFileToCrop(null)}
          title="Crop Profile Photo"
        />
      )}
    </div>
  );
}