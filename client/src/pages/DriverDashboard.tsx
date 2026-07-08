import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation, CheckCircle, Package, Phone, Loader2, Lock, Truck, LogOut, Sparkles, RotateCcw, Search, X, User, Map, PhoneCall, Wifi, WifiOff, DollarSign, History, Mic, Volume2, VolumeX, MessageSquare, QrCode, Camera, Send, Car, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/pages/useAuth";
import { formatPrice } from "@/lib/cart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { Html5Qrcode } from "html5-qrcode";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const EarningsBarChart = lazy(() => import("@/components/EarningsBarChart"));

function TypewriterText({ text, onComplete, renderContent }: { text: string, onComplete: () => void, renderContent: (content: string) => any }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i += 3;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        onComplete();
      }
    }, 15);
    return () => clearInterval(timer);
  }, [text, onComplete]);
  return <>{renderContent(displayed)}<span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[var(--brand)] animate-pulse" /></>;
}

export default function DriverDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'deliveries' | 'vehicle' | 'earnings'>('deliveries');
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [otp, setOtp] = useState("");
  const utils = trpc.useUtils();

  const [isForgotPin, setIsForgotPin] = useState(false);
  const [resetStep, setResetStep] = useState<"phone" | "otp">("phone");
  const [resetToken, setResetToken] = useState("");
  const [resetOtpCode, setResetOtpCode] = useState("");

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState<any>(null);
  const [customerChatInput, setCustomerChatInput] = useState("");

  // IMPORTANT: Declare driverInfo and isDriverAuth BEFORE using them in useQuery
  const [isDriverAuth, setIsDriverAuth] = useState(false);
  const [driverInfo, setDriverInfo] = useState<{ id: number; name: string } | null>(null);

  const { data: dbMessages } = trpc.fleet.getDeliveryMessages.useQuery(
    { orderId: activeChatOrder?.id ?? 0, agentId: driverInfo?.id },
    { enabled: !!activeChatOrder?.id, refetchInterval: 3000 } // Poll for new replies every 3s
  );

  const { data: unreadChatCount } = trpc.fleet.getUnreadDeliveryMessagesCount.useQuery(
    { agentId: driverInfo?.id ?? 0, userType: "driver" },
    { enabled: isDriverAuth && !!driverInfo?.id, refetchInterval: 5000 }
  );

  const markAsRead = trpc.fleet.markDeliveryMessagesAsRead.useMutation({
    onSuccess: () => {
      utils.fleet.getUnreadDeliveryMessagesCount.invalidate();
      utils.fleet.getDeliveryMessages.invalidate();
    }
  });

  useEffect(() => {
    if (activeChatOrder && dbMessages) {
      const hasUnread = dbMessages.some((msg: any) => msg.senderType === 'customer' && !msg.isRead);
      if (hasUnread) {
        markAsRead.mutate({ orderId: activeChatOrder.id, userType: "driver" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatOrder?.id, dbMessages]);

  const sendDeliveryMessage = trpc.fleet.sendDeliveryMessage.useMutation({
    onSuccess: () => {
      utils.fleet.getDeliveryMessages.invalidate({ orderId: activeChatOrder?.id, agentId: driverInfo?.id });
    }
  });

  const { data: myAssignment, refetch: refetchAssignment } = trpc.fleet.getMyAssignment.useQuery(
    { driverId: driverInfo?.id ?? 0, agentId: driverInfo?.id ?? 0 } as any, 
    { enabled: isDriverAuth && !!driverInfo?.id, refetchInterval: 15000 }
  );

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnImage, setReturnImage] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const createPresignedUrl = trpc.fleet.createPresignedUrl.useMutation();

  const requestReturn = trpc.fleet.requestVehicleReturn.useMutation({
    onSuccess: () => {
      toast.success("Vehicle return requested! Waiting for admin confirmation.");
      setReturnModalOpen(false);
      setReturnNotes("");
      setReturnImage("");
      refetchAssignment();
    }
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please upload an image.");
    setIsUploading(true);
    try {
      const result = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });
      if (result.uploadUrl && result.publicUrl) {
        await fetch(result.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        setReturnImage(result.publicUrl);
        toast.success("Photo uploaded!");
      } else {
        const reader = new FileReader();
        reader.onload = (event) => setReturnImage(event.target?.result as string);
        reader.readAsDataURL(file);
      }
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const upsertDriver = trpc.fleet.upsertDriver.useMutation({
    onSuccess: () => {
      toast.success("Profile photo updated successfully!");
      refetchProfile();
    },
    onError: (err) => toast.error("Failed to update photo: " + err.message)
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileToCrop(file);
    e.target.value = '';
  };

  const handleProfilePhotoUpload = async (file: File) => {
    setFileToCrop(null);
    setIsUploadingPhoto(true);
    try {
      const result = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });
      if (result.uploadUrl && result.publicUrl) {
        await fetch(result.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        upsertDriver.mutate({
          ...driverProfile,
          generatePin: false,
          photoUrl: result.publicUrl
        } as any);
      }
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // --- Offline Sync Queue ---
  const [syncQueue, setSyncQueue] = useState<{orderId: number, otp: string}[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("delivery_sync_queue") || "[]"); } catch { return []; }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("delivery_sync_queue", JSON.stringify(syncQueue));
  }, [syncQueue]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You are back online!");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Some features may be unavailable.");
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");

  const { data: settings } = trpc.settings.public.useQuery({ keys: ["general", "appearance", "ai"] });
  const storeName = settings?.general?.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem("store_name_cache") : null) || "Store";
  const logoUrl = settings?.appearance?.logoUrl ?? (typeof localStorage !== 'undefined' ? localStorage.getItem("store_logo_cache") : null);
  const isAiEnabled = (settings as any)?.ai?.enabled !== false;

  useEffect(() => {
    const savedToken = localStorage.getItem("driver_auth_token");
    if (savedToken) {
      try {
        const info = JSON.parse(savedToken);
        setDriverInfo(info);
        setIsDriverAuth(true);
      } catch {
        localStorage.removeItem("driver_auth_token");
        setIsDriverAuth(false);
      }
    }
  }, []);

  const [offlineDeliveries, setOfflineDeliveries] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("offline_deliveries") || "[]"); }
      catch { return []; }
    }
    return [];
  });

  const { data: liveDeliveries, isLoading } = trpc.fleet.myDeliveries.useQuery({ agentId: driverInfo?.id }, {
    refetchInterval: 10000,
    enabled: isDriverAuth,
  });

  // Automatically ask for permission and subscribe the driver to Push Notifications
  usePushNotifications(driverInfo?.id);

  // Real-time Location Tracking for Active Delivery
  const updateDriverLocation = trpc.fleet.updateDriverLocation.useMutation();
  const latestPositionRef = useRef<{lat: number, lng: number} | null>(null);
  
  useEffect(() => {
    if (!isDriverAuth || !driverInfo?.id || !activeOrderId) return;

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported. HTTPS is required on mobile devices.");
      return;
    }

    // Request permission if needed
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(() => {
        // Permission already handled by geolocation calls
      });
    }

    // Start tracking location in real-time
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latestPositionRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
      },
      (error) => {
        console.warn("Geolocation error:", error);
        if (error.code === 1) {
          toast.error("Please allow location access. (Note: HTTPS is required on mobile)");
        } else {
          toast.error(`Location error: ${error.message}`);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    // Broadcast the latest position every 5s
    const intervalId = setInterval(() => {
      if (latestPositionRef.current) {
        updateDriverLocation.mutate({
          agentId: driverInfo.id,
          orderId: activeOrderId,
          lat: latestPositionRef.current.lat,
          lng: latestPositionRef.current.lng
        });
      }
    }, 5000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDriverAuth, driverInfo?.id, activeOrderId]);

  useEffect(() => {
    if (liveDeliveries) {
      // Detect new assignments for Push Notifications
      const prevCount = offlineDeliveries.length;
      if (liveDeliveries.length > prevCount && prevCount > 0) {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("New Delivery Assigned", {
            body: "You have a new package ready for delivery!",
            icon: "/favicon.ico"
          });
        } else {
          toast.info("You have a new delivery assigned!");
        }
      }
      setOfflineDeliveries(liveDeliveries);
      localStorage.setItem("offline_deliveries", JSON.stringify(liveDeliveries));
    }
  }, [liveDeliveries, offlineDeliveries.length]);

  const deliveries = (isOnline && liveDeliveries) ? liveDeliveries : offlineDeliveries;

  type Delivery = any;

  const { data: dailyEarnings } = trpc.fleet.getEarnings.useQuery(
    { agentId: driverInfo?.id ?? 0, timeRange: 'week' },
    { enabled: isDriverAuth && !!driverInfo?.id }
  );

  const { data: driverProfile, isError: profileError, error: profileErrorObj, refetch: refetchProfile } = trpc.fleet.getDriverProfile.useQuery(
    { agentId: driverInfo?.id ?? 0 },
    { 
      refetchInterval: 10000,
      enabled: isDriverAuth && !!driverInfo?.id,
      retry: false // Don't retry if driver doesn't exist
    }
  );

  // If driver profile query fails, clear the stale auth token
  useEffect(() => {
    if (profileError && isDriverAuth && profileErrorObj?.data?.code === 'NOT_FOUND') {
      console.warn("❌ Driver profile not found. Clearing stale auth token...");
      localStorage.removeItem("driver_auth_token");
      setIsDriverAuth(false);
      setDriverInfo(null);
      toast.error("Your driver session is no longer valid. Please log in again.");
    }
  }, [profileError, isDriverAuth]);

  const updateAvailability = trpc.fleet.updateAvailability.useMutation({
    onSuccess: () => {
      toast.success("Status updated successfully!");
      refetchProfile();
    },
    onError: (err) => toast.error(err.message),
  });

  const completeDelivery = trpc.fleet.verifyOtpAndComplete.useMutation({
    onSuccess: () => {
      toast.success("Delivery marked as completed!");
      setActiveOrderId(null);
      setOtp("");
      utils.fleet.myDeliveries.invalidate();
    },
    onError: (err) => toast.error(err.message || "Invalid OTP"),
  });

  // Process sync queue when coming online
  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      toast.info(`Syncing ${syncQueue.length} offline delivery record(s)...`);
      const queue = [...syncQueue];
      setSyncQueue([]); // clear queue immediately to prevent double-firing
      queue.forEach(item => {
        completeDelivery.mutate(item);
      });
    }
  }, [isOnline, syncQueue.length, completeDelivery]);

  const handleVerifyOtp = (order: any, enteredOtp: string) => {
    if (isOnline) {
      completeDelivery.mutate({ orderId: order.id, otp: enteredOtp });
    } else {
      // Offline verification
      if (order.deliveryOtp === enteredOtp) {
        setSyncQueue(prev => [...prev, { orderId: order.id, otp: enteredOtp }]);
        setOfflineDeliveries(prev => prev.filter((d: any) => d.id !== order.id));
        setActiveOrderId(null);
        setOtp("");
        toast.success("Offline Mode: Delivery marked completed! It will sync automatically when your connection is restored.");
      } else {
        toast.error("Invalid OTP code.");
      }
    }
  };

  // --- QR Scanner Camera Logic ---
  useEffect(() => {
    if (!isScannerOpen) return;

    let html5QrCode: Html5Qrcode;
    
    const startCamera = async () => {
      try {
        html5QrCode = new Html5Qrcode("qr-reader-container");
        await html5QrCode.start(
          { facingMode: "environment" }, // Forces rear camera on mobile
          { fps: 10, qrbox: { width: 224, height: 224 } },
          (decodedText) => {
            html5QrCode.stop().catch(console.error);
            toast.success(`Package ${decodedText} verified successfully!`);
            setIsScannerOpen(false);
          },
          undefined // Ignore individual frame errors to prevent console spam
        );
      } catch (err) {
        console.error("Camera start error:", err);
        // Fails gracefully (e.g. on Desktop without a webcam)
      }
    };

    const timer = setTimeout(startCamera, 100);
    return () => {
      clearTimeout(timer);
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [isScannerOpen]);


  const startTrip = (orderId: number) => {
    setActiveOrderId(orderId);
    toast.success("Trip started! Broadcasting location...");
  };

  const verifyPin = trpc.fleet.verifyDriverPin.useMutation({
    onSuccess: (data) => {
      const info = { id: data.agentId, name: data.agentName };
      localStorage.setItem("driver_auth_token", JSON.stringify(info));
      setDriverInfo(info);
      setIsDriverAuth(true);
      toast.success(`Welcome back, ${data.agentName}`);
      window.dispatchEvent(new Event("driverAuthChanged"));
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDriverLogout = () => {
    localStorage.removeItem("driver_auth_token");
    setIsDriverAuth(false);
    setDriverInfo(null);
    toast.success("Signed out of driver portal");
    window.dispatchEvent(new Event("driverAuthChanged"));
  };

  const requestOtp = trpc.fleet.requestDriverPinOtp.useMutation({
    onSuccess: (data) => {
      toast.success(`Verification code sent to ${data.email}`);
      setResetToken(data.token);
      setResetStep("otp");
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyOtpAndReset = trpc.fleet.verifyDriverPinOtpAndReset.useMutation({
    onSuccess: () => {
      toast.success("Success! A new access PIN has been sent to your email.");
      setIsForgotPin(false);
      setResetStep("phone");
      setResetToken("");
      setResetOtpCode("");
      setPin("");
    },
    onError: (err) => toast.error(err.message),
  });

  const getDirections = (order: any) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      // Fallback to simple search
      window.open(`https://maps.google.com/?q=${encodeURIComponent(`${order.shippingAddress}, ${order.shippingCity}`)}`, '_blank');
      return;
    }

    toast.info("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const origin = `${latitude},${longitude}`;
        const destination = encodeURIComponent(`${order.shippingAddress}, ${order.shippingCity}, ${order.shippingCountry}`);
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
        window.open(url, '_blank');
      },
      () => {
        toast.error("Unable to retrieve your location. Opening address search instead.");
        window.open(`https://maps.google.com/?q=${encodeURIComponent(`${order.shippingAddress}, ${order.shippingCity}`)}`, '_blank');
      }
    );
  };

  // --- AI Assistant Hooks ---
  const [aiChatOpen, setAiChatOpen] = useState(() => {
    try { return sessionStorage.getItem("store_ai_open") === "true"; } catch { return false; }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string, suggestions?: string[] }[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [chatPosition, setChatPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("store_ai_messages");
      if (saved) {
        setChatMessages(JSON.parse(saved));
        return;
      }
    } catch {}

    const name = driverInfo?.name || "Driver";
    setChatMessages([{ role: 'assistant', content: `Hi, ${name}! I'm your delivery assistant. How can I help?` }]);
  }, [driverInfo?.name]);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState("");
  const [streamingMessageIndex, setStreamingMessageIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (typeof window !== "undefined") {
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
  }, []);

  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); } 
    else { if (recognitionRef.current) { recognitionRef.current.start(); setIsListening(true); toast.info("Listening..."); } else { toast.error("Voice input is not supported in your browser."); } }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, aiChatOpen]);

  // Auto-scroll actively while streaming
  useEffect(() => {
    if (streamingMessageIndex !== null) {
      const interval = setInterval(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }, 100);
      return () => clearInterval(interval);
    }
  }, [streamingMessageIndex]);

  useEffect(() => { sessionStorage.setItem("store_ai_open", String(aiChatOpen)); }, [aiChatOpen]);
  useEffect(() => { sessionStorage.setItem("store_ai_messages", JSON.stringify(chatMessages)); }, [chatMessages]);
  useEffect(() => { sessionStorage.setItem("store_ai_position", JSON.stringify(chatPosition)); }, [chatPosition]);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - chatPosition.x, y: e.clientY - chatPosition.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setChatPosition({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
  };
  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const aiMutation = trpc.ai.driverChat.useMutation({
    onSuccess: (data) => { 
      setChatMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, content: data.reply }];
        setStreamingMessageIndex(next.length - 1);
        return next as { role: "user" | "assistant"; content: string }[];
      }); 
      if (data.suggestions && data.suggestions.length > 0) setDynamicSuggestions(data.suggestions);
      speakResponse(data.reply);
    },
    onError: (error) => {
      let errorMessage = "Sorry, I ran into a network error. Please try again.";
      if (error.message.includes('quota') || error.message.includes('429')) {
        errorMessage = "The AI is currently unavailable due to high traffic or billing issues. Please check your plan and billing details, then try again later.";
      }
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: errorMessage }] as { role: "user" | "assistant"; content: string }[]);
    }
  });

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || aiMutation.isPending) return;
    
    // Check if driver is authenticated before allowing AI queries about deliveries
    if (!isDriverAuth) {
      toast.error("Please log in to access the delivery assistant. Use your phone and PIN to sign in.");
      const name = driverInfo?.name || "Driver";
      setChatMessages([
        { role: 'assistant', content: `Hi, ${name}! I'm your delivery assistant. To help you with your deliveries, please log in first using the login section above.` }
      ]);
      return;
    }
    
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages: { role: 'user' | 'assistant', content: string, suggestions?: string[] }[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(newMessages);
    setDynamicSuggestions([]);
    aiMutation.mutate({ message: userMsg, history: newMessages.slice(1), agentId: driverInfo?.id });
  };

  const handleNewChat = () => {
    const name = driverInfo?.name || "Driver";
    setChatMessages([{ role: 'assistant', content: `Hi, ${name}! I'm your delivery assistant. How can I help?` }]);
    setChatInput("");
    toast.success("New chat started!");
  };

  const driverSuggestedPrompts = [
    "What are my deliveries today?",
    "How do I request a payout?",
    "Show my offline status",
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    if (aiMutation.isPending) return;
    const newMessages: { role: 'user' | 'assistant', content: string, suggestions?: string[] }[] = [...chatMessages, { role: 'user', content: prompt }];
    setChatMessages(newMessages);
    setDynamicSuggestions([]);
    aiMutation.mutate({ message: prompt, history: newMessages.slice(1), agentId: driverInfo?.id });
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
            if (k < lines.length - 1) elements.push(<span key={`br-${i}-${j}-${k}`} className="block h-1.5" />);
          });
        }
      });
      if (i + 1 < linkParts.length) {
        elements.push(<Link key={`link-${i}`} href={linkParts[i + 2]} onClick={() => { setAiChatOpen(false); window.speechSynthesis?.cancel(); }} className="text-[var(--brand)] hover:underline font-semibold transition-colors">{linkParts[i + 1]}</Link>);
      }
    }
    return elements;
  };

  const filteredMessages = chatMessages.filter(msg => 
    !searchHistoryQuery.trim() || msg.content.toLowerCase().includes(searchHistoryQuery.toLowerCase())
  );

  // --- Content Resolution ---
  let mainContent;

  if (isLoading || authLoading) {
    mainContent = (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  } else if (!isAuthenticated) {
    mainContent = (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h2 className="text-xl font-bold mb-2">Sign in Required</h2>
          <p className="text-muted-foreground mb-4">Please log in to your account first.</p>
          <Button onClick={() => window.location.href = "/auth?redirect=/driver-portal"} className="bg-[var(--brand)] text-white">
            Go to Login
          </Button>
        </div>
      </div>
    );
  } else if (!isDriverAuth) {
    const handleDriverLogin = (e: React.FormEvent) => {
      e.preventDefault();
      verifyPin.mutate({ phone: phone.trim(), pin });
    };
    mainContent = (
      <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 shadow-lg border-border">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-[var(--brand)]" />
              </div>
              <h1 className="text-2xl font-bold font-display">
                {isForgotPin ? "Reset Access PIN" : "Driver Portal"}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {isForgotPin 
                  ? (resetStep === "phone" ? "Enter your phone or email to receive a reset code" : "Enter the 6-digit code sent to your email")
                  : "Enter your credentials to view your deliveries"}
              </p>
            </div>
            
            {!isForgotPin ? (
              <form onSubmit={handleDriverLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="phone">Email or Phone Number</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" placeholder="e.g. driver@store.com or +254..." className="pl-10 h-11" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pin">Access PIN</Label>
                    <button type="button" onClick={() => setIsForgotPin(true)} className="text-xs text-[var(--brand)] hover:underline">Forgot PIN?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="pin"
                      type="password"
                      placeholder="••••••"
                      className="pl-10 font-mono tracking-widest text-lg h-11"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      maxLength={6}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 bg-[var(--brand)] text-white hover:opacity-90" disabled={pin.length !== 6 || !phone || verifyPin.isPending}>
                  {verifyPin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login as Driver"}
                </Button>
              </form>
            ) : resetStep === "phone" ? (
              <form onSubmit={(e) => { e.preventDefault(); requestOtp.mutate({ phone: phone.trim() }); }} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="forgot-phone">Email or Phone Number</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="forgot-phone" placeholder="e.g. driver@store.com or +254..." className="pl-10 h-11" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 bg-[var(--brand)] text-white hover:opacity-90" disabled={!phone || requestOtp.isPending}>
                  {requestOtp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Verification Code"}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => setIsForgotPin(false)} className="text-sm text-muted-foreground hover:underline">Back to Login</button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); verifyOtpAndReset.mutate({ token: resetToken, code: resetOtpCode }); }} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp">6-Digit Verification Code</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="otp" placeholder="000000" className="pl-10 font-mono tracking-widest text-lg h-11" value={resetOtpCode} onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} autoFocus required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 bg-[var(--brand)] text-white hover:opacity-90" disabled={resetOtpCode.length !== 6 || verifyOtpAndReset.isPending}>
                  {verifyOtpAndReset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Reset PIN"}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => setResetStep("phone")} className="text-sm text-muted-foreground hover:underline">Back</button>
                </div>
              </form>
            )}
          </Card>
        </div>
    );
  } else {
    mainContent = (
      <div className="container pt-6 pb-8 max-w-lg mx-auto flex-1">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {driverProfile?.photoUrl ? (
                  <img src={driverProfile.photoUrl} alt="Driver" className="w-16 h-16 rounded-full object-cover border-2 border-border shadow-sm" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--brand)]/10 flex items-center justify-center border-2 border-[var(--brand)]/20 shadow-sm">
                    <User className="w-8 h-8 text-[var(--brand)]" />
                  </div>
                )}
                {isUploadingPhoto ? (
                  <div className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                        <Camera className="w-5 h-5" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                        <label className="flex items-center w-full gap-2"><Camera className="w-4 h-4"/> Take Selfie <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileSelect} disabled={isUploadingPhoto} /></label>
                      </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                        <label className="flex items-center w-full gap-2"><Upload className="w-4 h-4"/> Choose from Gallery <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={isUploadingPhoto} /></label>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold mb-1">Driver Dashboard</h1>
                <p className="text-muted-foreground">Hello, {driverInfo?.name || user?.name || "Driver"}</p>
              </div>
            </div>
            
            {driverProfile && (
              <div className="flex items-center gap-2 bg-card border border-border p-2.5 rounded-xl shadow-sm">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="flex items-center gap-3 pl-1">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{driverProfile.status === 'active' ? "Available" : "Offline"}</span>
                    <span className="text-xs text-muted-foreground">{activeOrderId ? "Out for delivery" : "Awaiting orders"}</span>
                  </div>
                  <Switch 
                    checked={driverProfile.status === 'active'} 
                    onCheckedChange={(checked) => updateAvailability.mutate({ agentId: driverProfile.id, isAvailable: checked })}
                    disabled={updateAvailability.isPending || !!activeOrderId || !isOnline}
                  />
                </div>
              </div>
            )}
          </div>
          
           <div className="grid grid-cols-3 gap-4">
             <Card className="p-4 flex flex-col items-center justify-center text-center bg-card border-border shadow-sm">
               <Package className="w-5 h-5 text-[var(--brand)] mb-2 opacity-80" />
               <p className="text-2xl font-bold text-foreground leading-none mb-1">{deliveries?.length || 0}</p>
               <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Packages</p>
             </Card>
             <Card className="p-4 flex flex-col items-center justify-center text-center bg-card border-border shadow-sm">
               <CheckCircle className="w-5 h-5 text-green-500 mb-2 opacity-80" />
               <p className="text-2xl font-bold text-foreground leading-none mb-1">{activeOrderId ? 1 : 0}</p>
               <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Active Trip</p>
             </Card>
             <Card className="p-4 flex flex-col items-center justify-center text-center bg-card border-border shadow-sm">
               <DollarSign className="w-5 h-5 text-blue-500 mb-2 opacity-80" />
               <p className="text-xl font-bold text-foreground leading-none mb-1">{dailyEarnings ? formatPrice(dailyEarnings.summary.today) : formatPrice(0)}</p>
               <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Earned Today</p>
             </Card>
           </div>
         </div>
 
        <div className="border-b border-border mb-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('deliveries')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'deliveries'
                  ? 'text-[var(--brand)] border-[var(--brand)]'
                  : 'text-muted-foreground border-transparent hover:bg-muted/50'
              }`}
            >
              Deliveries
            </button>
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'vehicle'
                  ? 'text-[var(--brand)] border-[var(--brand)]'
                  : 'text-muted-foreground border-transparent hover:bg-muted/50'
              }`}
            >
              Assigned Vehicle
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'earnings'
                  ? 'text-[var(--brand)] border-[var(--brand)]'
                  : 'text-muted-foreground border-transparent hover:bg-muted/50'
              }`}
            >
              Earnings
            </button>
          </div>
        </div>

        {activeTab === 'deliveries' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2 px-1">
              <h3 className="font-semibold text-muted-foreground">Assigned Packages</h3>
              <Button variant="outline" size="sm" className="gap-2 text-[var(--brand)] border-[var(--brand)]/30 hover:bg-[var(--brand)]/10" onClick={() => setIsScannerOpen(true)}>
                <QrCode className="w-4 h-4" /> Scan QR
              </Button>
            </div>
            {deliveries && deliveries.length > 0 ? (
              deliveries.map((order: Delivery) => {
                const isActive = activeOrderId === order.id;
                return (
                  <Card key={order.id} className={`p-5 shadow-sm transition-all overflow-hidden ${isActive ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : ""}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-mono text-sm font-bold text-[var(--brand)]">#{order.orderNumber}</p>
                        <p className="text-sm font-medium mt-0.5">{order.shippingFullName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatPrice(order.total)}</p>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mt-1 border ${order.paymentStatus === 'paid' ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-orange-500/10 text-orange-600 border-orange-200'}`}>
                          {order.paymentStatus === 'paid' ? 'Paid Online' : 'Collect Cash'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 mb-4 border border-border/50">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand)]/10 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-[var(--brand)]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">{order.shippingAddress}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{order.shippingCity}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                         <Button variant="secondary" className="flex-1 gap-2 text-xs h-9 bg-background hover:bg-muted shadow-sm px-0" onClick={() => getDirections(order)}>
                           <Map className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Directions</span><span className="sm:hidden">Map</span>
                         </Button>
                         <Button variant="secondary" className="flex-1 gap-2 text-xs h-9 bg-background hover:bg-muted shadow-sm px-0" onClick={() => window.location.href = `tel:${order.shippingPhone}`}>
                           <PhoneCall className="w-3.5 h-3.5" /> Call
                         </Button>
                         <Button variant="secondary" className="flex-1 gap-2 text-xs h-9 bg-background hover:bg-muted shadow-sm px-0" onClick={() => setActiveChatOrder(order)}>
                           <MessageSquare className="w-3.5 h-3.5" /> Message
                         </Button>
                      </div>
                    </div>

                    {!isActive ? (
                      <Button onClick={() => startTrip(order.id)} className="w-full bg-[var(--brand)] text-white gap-2 h-12 text-base font-semibold shadow-sm hover:opacity-90 transition-opacity" disabled={!isOnline}>
                        <Navigation className="w-5 h-5" /> Start Delivery
                      </Button>
                    ) : (
                      <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-center gap-2 bg-[var(--brand)]/10 text-[var(--brand)] py-2.5 rounded-lg border border-[var(--brand)]/20">
                          <div className="w-2 h-2 rounded-full bg-[var(--brand)] animate-ping" />
                          <p className="text-xs font-bold uppercase tracking-wider">Live Tracking Active</p>
                        </div>
                        
                        <div className="bg-muted/50 rounded-xl p-4 border border-border/50 text-center">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block font-semibold">Customer Delivery PIN</Label>
                          <div className="flex gap-2 justify-center max-w-[240px] mx-auto">
                            <Input
                              aria-label="Enter 4-digit OTP"
                              placeholder="Enter 4-digit OTP"
                              value={otp}
                              maxLength={4}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                              className="text-center font-mono text-2xl tracking-[0.5em] h-12 bg-background shadow-inner"
                            />
                            <Button 
                              onClick={() => handleVerifyOtp(order, otp)}
                              disabled={otp.length !== 4 || completeDelivery.isPending}
                              className="bg-green-600 text-white hover:bg-green-700 h-12 px-6 shadow-md transition-all"
                            >
                              {completeDelivery.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">Ask the customer for their 4-digit PIN to complete this delivery securely.</p>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No assigned deliveries.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vehicle' && (
          <Card className="p-5 border-border shadow-sm">
            <h3 className="font-semibold text-muted-foreground flex items-center gap-2 mb-4"><Car className="w-4 h-4" /> My Assigned Vehicle</h3>
            {myAssignment ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{myAssignment.vehicleName} <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border border-border ml-2">{myAssignment.vehiclePlate}</span></p>
                    <p className="text-sm text-muted-foreground capitalize mt-0.5">{myAssignment.vehicleType}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {myAssignment.status === 'pending_return' ? (
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">Pending Confirmation</Badge>
                  ) : (
                    <Button onClick={() => { if(confirm("Request to return this vehicle?")) { requestReturn.mutate({ assignmentId: myAssignment.id }); } }} variant="outline" className="border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand)]/10 w-full sm:w-auto" disabled={requestReturn.isPending}>
                      {requestReturn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Return"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border"><p>No vehicle currently assigned to you.</p></div>
            )}
          </Card>
        )}

        {activeTab === 'earnings' && (
          <EarningsContent agentId={driverInfo?.id ?? null} />
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20 relative">
      {/* Unified Driver Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50 shadow-sm relative">
        <div className="container">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0 z-10">
              {logoUrl ? <img src={logoUrl} alt={storeName} className="h-8 object-contain" /> : <div className="w-8 h-8 rounded-md bg-[var(--brand)]/10 flex items-center justify-center"><Truck className="w-4 h-4 text-[var(--brand)]" /></div>}
              <span className="font-display font-bold text-lg tracking-tight hidden sm:block">{storeName}</span>
            </Link>

            {/* Centered Driver Text */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
              <Truck className="w-5 h-5 text-[var(--brand)]" />
              <span className="font-display font-bold text-lg tracking-tight text-[var(--brand)]">Driver Portal</span>
            </div>

            <div className="flex items-center gap-2 z-10">
              {isAiEnabled && (
                <Button variant="ghost" size="icon" onClick={() => setAiChatOpen(!aiChatOpen)} aria-label="Toggle AI Assistant">
                  <Sparkles className="w-4.5 h-4.5 text-[var(--brand)]" />
                </Button>
              )}
              {isDriverAuth && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative hover:bg-[var(--brand)]/10" 
                  onClick={() => {
                    if (activeOrderId) {
                      const order = deliveries?.find((d: any) => d.id === activeOrderId);
                      if (order) setActiveChatOrder(order);
                    } else if (deliveries?.length === 1) {
                      setActiveChatOrder(deliveries[0]);
                    } else if (deliveries?.length > 1) {
                      toast.info("Please tap 'Message' on a specific package below.");
                      setActiveTab('deliveries');
                    } else {
                      setActiveTab('deliveries');
                      toast.info("Start a delivery to chat with the customer.");
                    }
                  }} 
                  aria-label="Messages"
                >
                  <MessageSquare className="w-5 h-5 text-muted-foreground hover:text-[var(--brand)] transition-colors" />
                  {unreadChatCount && unreadChatCount > 0 ? (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-destructive shadow-[0_0_0_2px_var(--background)]" />
                  ) : null}
                </Button>
              )}
              {isAuthenticated && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full ring-2 ring-transparent hover:ring-[var(--brand)]/30 transition-all ml-1" aria-label="Driver menu">
                      {isDriverAuth && driverProfile?.photoUrl ? (
                        <img src={driverProfile.photoUrl} alt={driverInfo?.name || "Driver"} className="w-8 h-8 rounded-full object-cover border border-[var(--brand)]/20 shadow-sm" />
                      ) : user?.photoId ? (
                        <img src={user.photoId} alt={user.name || "User"} className="w-8 h-8 rounded-full object-cover border border-[var(--brand)]/20 shadow-sm" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[var(--brand)]/10 flex items-center justify-center border border-[var(--brand)]/20 shadow-sm">
                          <span className="text-sm font-semibold text-[var(--brand)]">
                            {(isDriverAuth ? driverInfo?.name : user?.name)?.charAt(0)?.toUpperCase() ?? "U"}
                          </span>
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2.5 border-b border-border bg-muted/30 mb-1">
                      <p className="text-sm font-semibold truncate text-foreground">{isDriverAuth ? driverInfo?.name : user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        {isDriverAuth ? <><Truck className="w-3 h-3" /> Delivery Agent</> : <><User className="w-3 h-3" /> Customer</>}
                      </p>
                    </div>
                    {isDriverAuth && (
                      <DropdownMenuItem onClick={() => setActiveTab('earnings')} className="cursor-pointer py-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" /> <span>My Earnings</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild className="cursor-pointer py-2">
                      <Link href="/dashboard" className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" /> <span>Customer Account</span>
                      </Link>
                    </DropdownMenuItem>
                    {isDriverAuth && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDriverLogout} className="text-destructive focus:text-destructive cursor-pointer py-2">
                          <LogOut className="w-4 h-4 mr-2" /> <span>Sign Out of Portal</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
        
        {/* Global Offline Mode Indicator */}
        {!isOnline && (
          <div className="absolute top-full left-0 w-full bg-destructive text-destructive-foreground text-center py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top-2">
            <WifiOff className="w-4 h-4 animate-pulse" />
            OFFLINE MODE — Your deliveries will sync automatically when connection is restored
          </div>
        )}
      </header>

      {/* Main Content Render */}
      {mainContent}

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto shrink-0">
        <div className="container flex flex-col sm:flex-row items-center justify-between p-6 gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/legal/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/legal/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </footer>

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/80 z-[110] flex flex-col items-center justify-center p-4 animate-in fade-in">
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scan-line { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
            .animate-scan { animation: scan-line 2.5s ease-in-out infinite; }
          `}} />
          <div className="w-full max-w-sm bg-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-bold flex items-center gap-2"><QrCode className="w-5 h-5 text-[var(--brand)]"/> Scan Package</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsScannerOpen(false)} className="h-8 w-8 rounded-full"><X className="w-4 h-4"/></Button>
            </div>
            <div className="aspect-square bg-black relative flex items-center justify-center overflow-hidden">
              {/* The live camera feed mounts inside this div */}
              <div id="qr-reader-container" className="absolute inset-0 w-full h-full object-cover [&>video]:object-cover [&>video]:h-full [&>video]:w-full"></div>
              <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] mix-blend-overlay pointer-events-none"></div>
              <div className="w-56 h-56 border-2 border-[var(--brand)]/50 rounded-2xl relative shadow-[0_0_0_999px_rgba(0,0,0,0.5)] pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-[var(--brand)] animate-scan shadow-[0_0_8px_2px_var(--brand)]" />
                {/* Corner markers */}
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-[var(--brand)] rounded-tl-xl" />
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-[var(--brand)] rounded-tr-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-[var(--brand)] rounded-bl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-[var(--brand)] rounded-br-xl" />
              </div>
              <p className="absolute bottom-6 text-white/70 text-sm font-medium tracking-wide">Align QR code within frame</p>
            </div>
            <div className="p-5 bg-card">
              <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wider font-semibold">Or enter package ID manually</p>
              <div className="flex gap-2">
                <Input placeholder="PKG-12345" className="bg-muted/50 h-10" id="pkg-input" />
                <Button className="bg-[var(--brand)] text-white hover:opacity-90 h-10 px-6" onClick={() => {
                  const val = (document.getElementById('pkg-input') as HTMLInputElement)?.value;
                  if(val) {
                    toast.success(`Package ${val} verified!`);
                    setIsScannerOpen(false);
                  } else {
                    toast.error("Please enter a package ID");
                  }
                }}>Verify</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Vehicle Modal */}
      {returnModalOpen && myAssignment && (
        <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Return Vehicle</h3>
              <Button variant="ghost" size="icon" onClick={() => setReturnModalOpen(false)} className="h-8 w-8 rounded-full"><X className="w-4 h-4"/></Button>
            </div>
            <div className="space-y-2">
              <Label>Condition Photo (Optional)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                {returnImage ? (
                  <div className="relative">
                    <img src={returnImage} className="w-full h-40 object-cover rounded" alt="Vehicle condition" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setReturnImage("")}><X className="w-3 h-3"/></Button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
                    {isUploading ? <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /> : <Camera className="w-8 h-8 text-muted-foreground mb-2" />}
                    <span className="text-sm font-medium">{isUploading ? "Uploading..." : "Tap to take a photo"}</span>
                  </label>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Return Notes (Optional)</Label>
              <Textarea placeholder="e.g. Returned with full tank..." value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} />
            </div>
            <Button className="w-full bg-[var(--brand)] text-white hover:opacity-90" disabled={requestReturn.isPending || isUploading} onClick={() => requestReturn.mutate({ assignmentId: myAssignment.id, imageUrl: returnImage, notes: returnNotes })}>
              {requestReturn.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Return Request
            </Button>
          </Card>
        </div>
      )}

      {/* Customer Chat Modal */}
      {activeChatOrder && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-md bg-card sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh] sm:h-[600px] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 flex items-center justify-center border border-[var(--brand)]/20">
                  <User className="w-5 h-5 text-[var(--brand)]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{activeChatOrder.shippingFullName}</h3>
                  <p className="text-xs text-muted-foreground">Order #{activeChatOrder.orderNumber}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setActiveChatOrder(null)}><X className="w-4 h-4"/></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              <div className="text-center my-4">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted px-2 py-1 rounded-full">Secure Chat Started</span>
              </div>
              {(dbMessages || []).map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderType === 'driver' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] shadow-sm ${msg.senderType === 'driver' ? 'bg-[var(--brand)] text-white rounded-tr-sm' : 'bg-muted text-foreground border border-border/50 rounded-tl-sm'}`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1.5 mx-1 font-medium">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border bg-card shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {["I'll be there in 5 minutes!", "Traffic is heavy, running late.", "I've arrived!"].map(reply => (
                  <button 
                    key={reply} 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      sendDeliveryMessage.mutate({ orderId: activeChatOrder.id, content: reply, senderType: 'driver', agentId: driverInfo?.id });
                    }}
                    className="shrink-0 bg-muted hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] text-xs px-3 py-1.5 rounded-full border border-border/50 whitespace-nowrap transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                if(!customerChatInput.trim() || sendDeliveryMessage.isPending) return;
                sendDeliveryMessage.mutate({ orderId: activeChatOrder.id, content: customerChatInput.trim(), senderType: 'driver', agentId: driverInfo?.id });
                setCustomerChatInput("");
              }}>
                <Input placeholder="Message customer..." value={customerChatInput} onChange={e => setCustomerChatInput(e.target.value)} disabled={sendDeliveryMessage.isPending} className="bg-muted/50 border-transparent focus-visible:ring-[var(--brand)]/50 h-11 rounded-xl" autoFocus />
                <Button type="submit" size="icon" className="bg-[var(--brand)] text-white shrink-0 hover:opacity-90 disabled:opacity-50 h-11 w-11 rounded-xl" disabled={!customerChatInput.trim() || sendDeliveryMessage.isPending}>
                  {sendDeliveryMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Chat Card */}
      {aiChatOpen && (
        <div 
          className="fixed bottom-6 right-6 z-[100] transition-opacity duration-300 opacity-100 chat-widget"
          style={{ "--chat-x": `${chatPosition.x}px`, "--chat-y": `${chatPosition.y}px` } as React.CSSProperties}
        >
          <div className="w-80 sm:w-96 h-[32rem] bg-card border border-border shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div 
              className={`px-5 py-4 border-b border-border/50 bg-gradient-to-r from-[var(--brand)]/8 to-[var(--brand)]/4 flex items-center justify-between select-none touch-none flex-shrink-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className="flex items-center gap-2.5 pointer-events-none">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/20 text-[var(--brand)] flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-[0.95rem]">{storeName}</h3>
                  <p className="text-[0.7rem] text-muted-foreground font-medium">Delivery Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-foreground transition-colors" onClick={handleNewChat} title="New Chat" aria-label="New Chat">
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button 
                  variant={isSearchingHistory ? "secondary" : "ghost"} 
                  size="icon" 
                  className="h-7 w-7 rounded-lg hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-foreground transition-colors" 
                  onClick={() => {
                    setIsSearchingHistory(!isSearchingHistory);
                    if (isSearchingHistory) setSearchHistoryQuery("");
                  }} 
                  title="Search Chat History"
                  aria-label="Search Chat History"
                >
                  <Search className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setIsMuted(!isMuted); if (!isMuted) window.speechSynthesis?.cancel(); }} title={isMuted ? "Unmute AI Voice" : "Mute AI Voice"} aria-label="Toggle Voice">
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" onClick={() => { setAiChatOpen(false); window.speechSynthesis?.cancel(); }} aria-label="Close chat">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {isSearchingHistory && (
              <div className="p-3 border-b border-border bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search history..." aria-label="Search chat history" className="w-full h-8 pl-8 pr-8 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" value={searchHistoryQuery} onChange={(e) => setSearchHistoryQuery(e.target.value)} autoFocus />
                  {searchHistoryQuery && (
                  <button onClick={() => setSearchHistoryQuery("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gradient-to-b from-background/50 to-background" ref={chatScrollRef}>
              {filteredMessages.length > 0 ? (
                filteredMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 flex-shrink-0`}>
                    <div className={`max-w-[85%] sm:max-w-[75%] ${
                      msg.role === 'user' 
                        ? 'rounded-2xl rounded-tr-md bg-[var(--brand)] text-white shadow-md' 
                        : 'rounded-2xl rounded-tl-md bg-muted text-foreground shadow-sm'
                    } px-4 py-3 break-words whitespace-normal`}>
                      <div className={`text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'font-medium' : 'font-normal'}`}>
                        {msg.role === 'assistant' ? (
                          streamingMessageIndex === i ? (
                            <TypewriterText text={msg.content} onComplete={() => setStreamingMessageIndex(null)} renderContent={renderMessageContent} />
                          ) : renderMessageContent(msg.content)
                        ) : msg.content}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">No messages found for "{searchHistoryQuery}"</div>
              )}
              {chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant' && !aiMutation.isPending && !searchHistoryQuery && (
                <div className="flex flex-col gap-2 mt-2 flex-shrink-0 animate-in fade-in duration-300">
                  <p className="text-[0.75rem] text-muted-foreground font-semibold uppercase tracking-wider px-1">Suggested for you</p>
                  <div className="flex flex-wrap gap-2">
                  {(dynamicSuggestions.length > 0 ? dynamicSuggestions : driverSuggestedPrompts).map(prompt => (
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
              {aiMutation.isPending && !searchHistoryQuery && (
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
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} aria-label="Chat input" placeholder={!isDriverAuth ? "Sign in to ask about deliveries..." : isListening ? "Listening..." : "Ask about deliveries..."} disabled={!isDriverAuth} className="w-full h-10 pl-3.5 pr-9 text-sm rounded-lg border border-input/60 bg-background hover:border-input focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 focus:border-[var(--brand)] transition-all placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                  <button type="button" onClick={toggleListening} disabled={!isDriverAuth} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors p-1 rounded hover:bg-muted/50 ${isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-foreground'} ${!isDriverAuth ? 'opacity-50 cursor-not-allowed' : ''}`} title="Voice Search">
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <Button type="submit" size="sm" className="bg-[var(--brand)] text-white hover:opacity-90 h-10 px-4 rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={!chatInput.trim() || aiMutation.isPending || !isDriverAuth}>Send</Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Simple Image Cropper Modal */}
      {fileToCrop && (
        <ImageCropperModal
          file={fileToCrop}
          onCrop={(file) => handleProfilePhotoUpload(file)}
          onCancel={() => setFileToCrop(null)}
          title="Crop Profile Photo"
        />
      )}
    </div>
  );
}

function EarningsContent({ agentId }: { agentId: number | null }) {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const utils = trpc.useUtils();

  const { data: earningsData, isLoading } = trpc.fleet.getEarnings.useQuery(
    { agentId: agentId!, timeRange: 'week' },
    { enabled: !!agentId }
  );

  const { data: payoutHistory, isLoading: historyLoading } = trpc.fleet.getPayoutHistory.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId }
  );

  const requestPayout = trpc.fleet.requestPayout.useMutation({
    onSuccess: () => {
      toast.success("Payout request submitted! It will be processed shortly.");
      setShowPayoutModal(false);
      utils.fleet.getEarnings.invalidate({ agentId: agentId! });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to request payout.");
      setShowPayoutModal(false);
    }
  });

  if (isLoading) {
    return <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)] mx-auto mt-10" />;
  }

  if (!earningsData) {
    return <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">No earnings data available.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground font-medium uppercase">Today</p><p className="text-2xl font-bold mt-1">{formatPrice(earningsData.summary.today)}</p></Card>
        <Card className="p-4 text-center bg-[var(--brand)]/10 border-[var(--brand)]/20"><p className="text-xs text-[var(--brand)] font-medium uppercase">This Week</p><p className="text-2xl font-bold mt-1 text-[var(--brand)]">{formatPrice(earningsData.summary.week)}</p></Card>
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground font-medium uppercase">This Month</p><p className="text-2xl font-bold mt-1">{formatPrice(earningsData.summary.month)}</p></Card>
      </div>

      <Card className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
        <div>
          <p className="text-sm text-green-800 dark:text-green-300 font-medium">Available for Payout</p>
          <p className="text-3xl font-bold mt-1 text-green-700 dark:text-green-300">{formatPrice(earningsData.summary.withdrawable || 0)}</p>
        </div>
        <Button size="lg" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white gap-2 shadow-md" onClick={() => setShowPayoutModal(true)} disabled={(earningsData.summary.withdrawable || 0) <= 0}>
          <DollarSign className="w-5 h-5" /> Request Payout
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 text-muted-foreground">Weekly Income</h3>
        <div className="h-[250px]">
          <Suspense fallback={<div className="h-full flex items-center justify-center text-muted-foreground">Loading chart…</div>}>
            <EarningsBarChart chartData={earningsData.chartData} />
          </Suspense>
        </div>
      </Card>

      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-muted-foreground" /> Recent Earnings</h3>
        <div className="space-y-2">
          {earningsData.breakdown.map((item: any, i: number) => (
            <Card key={i} className="p-3 flex items-center justify-between">
              <div><p className="font-mono text-xs font-semibold">#{item.orderNumber}</p><p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString()}</p></div>
              <p className="font-bold text-green-600">+{formatPrice(item.earnings)}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 text-muted-foreground flex items-center gap-2"><History className="w-4 h-4" /> Payout History</h3>
        {historyLoading ? (
          <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !payoutHistory || payoutHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No payout history found.</p>
        ) : (
          <div className="space-y-2">
            {payoutHistory.map((payout: any) => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border/50">
                <div>
                  <p className="font-semibold">{formatPrice(payout.amount)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(payout.requestedAt).toLocaleString()}</p>
                </div>
                <Badge variant={payout.status === 'completed' ? 'secondary' : payout.status === 'failed' ? 'destructive' : 'secondary'} className={`capitalize ${payout.status === 'completed' ? 'bg-green-100 text-green-800' : ''}`}>
                  {payout.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-md shadow-xl animate-in zoom-in-95 duration-300">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Confirm Payout</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPayoutModal(false)} aria-label="Close payout modal">✕</Button>
              </div>
              <div className="text-center bg-muted/50 p-6 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">You are about to request a payout of</p>
                <p className="text-4xl font-bold my-2 text-[var(--brand)]">{formatPrice(earningsData.summary.withdrawable)}</p>
                <p className="text-sm text-muted-foreground">to your registered M-Pesa number.</p>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Payouts are processed within 24 hours. Ensure your M-Pesa details are correct in your profile.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowPayoutModal(false)}>Cancel</Button>
                <Button 
                  type="button" 
                  disabled={requestPayout.isPending} 
                  className="bg-green-600 text-white hover:bg-green-700 min-w-24"
                  onClick={() => requestPayout.mutate({ agentId: agentId!, amount: earningsData.summary.withdrawable })}
                >
                  {requestPayout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}