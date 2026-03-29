import { useAuth } from "@/pages/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { getGuestCart, clearGuestCart, formatPrice } from "@/lib/cart";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  LogOut,
  Menu,
  Monitor,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Heart,
  User,
  X,
  LayoutDashboard,
  Headphones,
  Loader2,
  Sparkles,
  RotateCcw,
  Mic,
  Volume2,
  VolumeX,
} from "lucide-react";
import { dynamicIconMap } from "@/lib/iconMap";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";

const categoryIcons: Record<string, React.ReactNode> = {
  laptops: <Monitor className="w-4 h-4" />,
  desktops: <Cpu className="w-4 h-4" />,
  accessories: <Headphones className="w-4 h-4" />,
};

const getCategoryIcon = (cat: any) => {
  if (cat.icon && dynamicIconMap[cat.icon]) {
    const CustomIcon = dynamicIconMap[cat.icon];
    return <CustomIcon className="w-4 h-4" />;
  }
  return categoryIcons[cat.slug] ?? <Package className="w-4 h-4" />;
};

function TypewriterText({ text, onComplete, renderContent }: { text: string, onComplete: () => void, renderContent: (content: string) => any }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i += 3; // Number of characters to reveal per tick
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        onComplete();
      }
    }, 15); // Speed of the stream
    return () => clearInterval(timer);
  }, [text, onComplete]);
  return <>{renderContent(displayed)}<span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[var(--brand)] animate-pulse" /></>;
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [isPageScrolling, setIsPageScrolling] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(() => {
    try { return sessionStorage.getItem("store_ai_open") === "true"; } catch { return false; }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string, products?: any[], suggestions?: string[] }[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [streamingMessageIndex, setStreamingMessageIndex] = useState<number | null>(null);
  const clearHistoryMutation = trpc.ai.clearHistory.useMutation();

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

  // ─── Load Persisted Database Memory ───
  const { data: dbHistory } = trpc.ai.getHistory.useQuery(undefined, {
    enabled: isAuthenticated && aiChatOpen,
    staleTime: Infinity,
  });
  
  useEffect(() => {
    if (dbHistory && dbHistory.length > 0 && chatMessages.length <= 1) {
      const formatted = dbHistory.map(h => ({ role: h.role as 'user' | 'assistant', content: h.message })).reverse();
      setChatMessages(formatted);
    }
  }, [dbHistory]);

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
    try {
      const saved = sessionStorage.getItem("store_ai_messages");
      if (saved) { setChatMessages(JSON.parse(saved)); return; }
    } catch {}
    const displayName = user?.name ? `, ${user.name}` : " there";
    
    let contextGreeting = "What are you looking for today?";
    if (location.includes("/cart")) contextGreeting = "Need help reviewing your cart before checkout?";
    else if (location.includes("/products")) contextGreeting = "Looking for something specific in our catalog?";
    else if (location.includes("/dashboard/orders")) contextGreeting = "Need help tracking your recent orders?";
    
    setChatMessages([{ role: 'assistant', content: `Hi${displayName}! I'm your shopping assistant. ${contextGreeting}` }]);
  }, [user, location]);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: cartItems } = trpc.cart.get.useQuery(undefined, { enabled: isAuthenticated });
  const activeCategories = (categories as any[]) ? (categories as any[]).filter(c => c.active !== false) : [];
  const orderedCategories = [...activeCategories].sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
  const rootCategories = orderedCategories.filter(c => !(c as any).parentId);

  const { data: settings } = trpc.settings.public.useQuery({ keys: ["general", "appearance"] });
  const storeName = settings?.general?.storeName || (typeof localStorage !== 'undefined' ? localStorage.getItem("store_name_cache") : null) || "Store";
  const logoUrl = settings?.appearance?.logoUrl ?? (typeof localStorage !== 'undefined' ? localStorage.getItem("store_logo_cache") : null);

  const [chatPosition, setChatPosition] = useState(() => {
    try {
      const saved = sessionStorage.getItem("store_ai_position");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: 0, y: 0 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [mobileOpen]);

  const [guestCartCount, setGuestCartCount] = useState(0);
  useEffect(() => {
    const update = () => {
      const items = getGuestCart();
      setGuestCartCount(items.length);
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("guestCartUpdated", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("guestCartUpdated", update);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading: searching } = trpc.products.list.useQuery(
    { search: debouncedSearch, limit: 5 },
    { enabled: debouncedSearch.trim().length > 1 }
  );

  const cartCount = isAuthenticated
    ? (cartItems?.length ?? 0)
    : guestCartCount;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Auto-scroll AI chat to bottom on new messages
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

  // Scroll transparency effect
  useEffect(() => {
    if (!aiChatOpen) return;
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      setIsPageScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setIsPageScrolling(false), 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [aiChatOpen]);

  // Persist Assistant state across page navigations
  useEffect(() => {
    sessionStorage.setItem("store_ai_open", String(aiChatOpen));
  }, [aiChatOpen]);

  useEffect(() => {
    sessionStorage.setItem("store_ai_messages", JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    sessionStorage.setItem("store_ai_position", JSON.stringify(chatPosition));
  }, [chatPosition]);

  // Dragging event handlers for the floating assistant
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevent dragging if the user is clicking the close button
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - chatPosition.x,
      y: e.clientY - chatPosition.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setChatPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const aiMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setChatMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, content: data.reply }];
        setStreamingMessageIndex(next.length - 1);
        return next as { role: "user" | "assistant"; content: string }[];
      });
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
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages: { role: 'user' | 'assistant', content: string, products?: any[], suggestions?: string[] }[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(newMessages);
    setDynamicSuggestions([]);
    
    // Pass the active cart context to the AI so it doesn't recommend duplicate items
    const currentCart = isAuthenticated 
      ? (cartItems || []).map(i => ({ productId: i.productId, quantity: i.quantity }))
      : getGuestCart().map(i => ({ productId: i.productId, quantity: i.quantity }));
      
    aiMutation.mutate({ 
      message: userMsg, 
      history: newMessages.slice(1), 
      cartContext: currentCart.length > 0 ? currentCart : undefined,
      userId: user?.id,
      userEmail: user?.email,
    });
  };

  const handleNewChat = () => {
    const displayName = user?.name ? `, ${user.name}` : " there";
    setChatMessages([
      { role: 'assistant', content: `Hi${displayName}! I'm your shopping assistant. What are you looking for today?` }
    ]);
    setChatInput("");
    sessionStorage.removeItem("store_ai_messages");
    if (isAuthenticated) clearHistoryMutation.mutate();
    toast.success("New chat started!");
  };

  const customerSuggestedPrompts = [
    "Find a gaming laptop",
    "What is your return policy?",
    "Recommend a budget PC",
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    if (aiMutation.isPending) return;
    const newMessages: { role: 'user' | 'assistant', content: string, products?: any[], suggestions?: string[] }[] = [...chatMessages, { role: 'user', content: prompt }];
    setChatMessages(newMessages);
    setDynamicSuggestions([]);
    const currentCart = isAuthenticated 
      ? (cartItems || []).map(i => ({ productId: i.productId, quantity: i.quantity }))
      : getGuestCart().map(i => ({ productId: i.productId, quantity: i.quantity }));
    aiMutation.mutate({ 
      message: prompt, 
      history: newMessages.slice(1), 
      cartContext: currentCart.length > 0 ? currentCart : undefined,
      userId: user?.id,
      userEmail: user?.email,
    });
  };

  // Safely intercept and render markdown links returned by the AI
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

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const renderAutocomplete = () => {
    if (searchQuery.trim().length <= 1) return null;
    return (
      <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
        {searching ? (
          <div className="p-4 flex justify-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : searchResults && searchResults.length > 0 ? (
          <div className="flex flex-col">
            {searchResults.map(product => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                onClick={() => { setSearchOpen(false); setMobileOpen(false); setSearchQuery(""); }}
                className="flex items-center gap-3 p-2 hover:bg-muted transition-colors border-b border-border last:border-0"
              >
                <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                  {product.images && Array.isArray(product.images) && product.images[0] ? (
                    <img src={product.images[0] as string} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-[var(--brand)] font-semibold">{formatPrice(product.price)}</p>
                </div>
              </Link>
            ))}
            <button type="submit" className="p-2 text-xs text-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium border-t border-border">
              View all results for "{searchQuery}"
            </button>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">No products found</div>
        )}
      </div>
    );
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-background/80 backdrop-blur-xl shadow-sm border-b border-border" : "bg-background border-b border-transparent"
        }`}
      >
      {/* Top bar */}
      <div className="container">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {logoUrl && (
              <img src={logoUrl} alt={storeName} className="h-8 object-contain" />
            )}
            <span className="font-display font-bold text-lg tracking-tight">
              {storeName}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === "/" ? "text-[var(--brand)]" : "text-muted-foreground hover:text-foreground"}`}>
              Home
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Products <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem key="all-products" asChild>
                  <Link href="/products" className="flex items-center gap-2 cursor-pointer">
                    <Package className="w-4 h-4" /> All Products
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
            {rootCategories.map((cat) => {
              const children = orderedCategories.filter(c => (c as any).parentId === cat.id);
              if (children.length > 0) {
                return (
                  <DropdownMenuSub key={cat.id}>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                      {getCategoryIcon(cat)} {cat.name}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56 p-1.5 shadow-xl border-border/60">
                      <DropdownMenuItem asChild className="py-2.5 px-3">
                        <Link href={`/products?category=${cat.slug}`} className="cursor-pointer font-semibold text-[var(--brand)]">All {cat.name}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {children.map(child => (
                        <DropdownMenuItem key={child.id} asChild className="group/item py-2.5 px-3 focus:bg-muted/50 transition-colors">
                          <Link href={`/products?category=${child.slug}`} className="cursor-pointer flex items-center justify-between w-full text-muted-foreground focus:text-foreground">
                            <span>{child.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300 text-[var(--brand)]" />
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              }
              return (
                <DropdownMenuItem key={cat.id} asChild>
                  <Link href={`/products?category=${cat.slug}`} className="flex items-center gap-2 cursor-pointer">
                    {getCategoryIcon(cat)}
                    {cat.name}
                  </Link>
                </DropdownMenuItem>
              );
            })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/products?featured=true" className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Deals
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2 relative">
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                aria-label="Search products"
                  className="w-48 sm:w-64 h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              <Button type="button" variant="ghost" size="icon" onClick={() => setSearchOpen(false)} aria-label="Close search">
                  <X className="w-4 h-4" />
                </Button>
                {renderAutocomplete()}
              </form>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="hidden sm:flex" aria-label="Open search">
                <Search className="w-4.5 h-4.5" />
              </Button>
            )}

            {/* AI Assistant */}
            <Button variant="ghost" size="icon" onClick={() => setAiChatOpen(!aiChatOpen)} className="hidden sm:flex" aria-label="Toggle AI Assistant">
              <Sparkles className="w-4.5 h-4.5 text-[var(--brand)]" />
            </Button>

        {/* Wishlist */}
        {isAuthenticated && (
          <Link href="/dashboard/wishlist">
            <Button variant="ghost" size="icon" className="hidden sm:flex" aria-label="Wishlist">
              <Heart className="w-4.5 h-4.5" />
            </Button>
          </Link>
        )}

            {/* Cart */}
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative" aria-label="Cart">
                <ShoppingCart className="w-4.5 h-4.5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[var(--brand)] text-white text-[10px] font-bold flex items-center justify-center">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="w-7 h-7 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-[var(--brand)]">
                        {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium truncate">{user?.name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuItem key="nav-dashboard" asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem key="nav-orders" asChild>
                    <Link href="/dashboard/orders" className="flex items-center gap-2 cursor-pointer">
                      <Package className="w-4 h-4" /> My Orders
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem key="nav-admin" asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="w-4 h-4" /> Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = getLoginUrl(location))}
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  className="bg-[var(--brand)] text-white hover:opacity-90"
                  onClick={() => (window.location.href = getLoginUrl(location, "register"))}
                >
                  Sign Up
                </Button>
              </div>
            )}

            {/* AI Assistant Mobile */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setAiChatOpen(!aiChatOpen)} aria-label="Toggle AI Assistant">
              <Sparkles className="w-4.5 h-4.5 text-[var(--brand)]" />
            </Button>

            {/* Mobile menu toggle */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open mobile menu">
              <Menu className="w-4.5 h-4.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div 
        className={`fixed top-0 left-0 h-full w-[85%] max-w-sm bg-background border-r border-border z-[70] transform transition-transform duration-300 ease-in-out md:hidden flex flex-col shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 border-b border-border flex items-center justify-between shrink-0">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
            {logoUrl && (
              <img src={logoUrl} alt={storeName} className="h-8 object-contain" />
            )}
            <span className="font-display font-bold text-lg tracking-tight">
              {storeName}
            </span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close mobile menu">
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
        
        {/* Sidebar Content */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col">
          <form onSubmit={handleSearch} className="flex gap-2 mb-6 relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
              className="flex-1 h-11 px-4 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-[var(--brand)] shadow-sm"
            />
            <Button type="submit" size="icon" className="bg-[var(--brand)] text-white h-11 w-11 rounded-xl shadow-sm hover:opacity-90 shrink-0" aria-label="Submit search">
              <Search className="w-4.5 h-4.5" />
            </Button>
            {renderAutocomplete()}
          </form>

          <div className="space-y-1.5 mb-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Navigation</p>
            <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] transition-colors">
              Home
            </Link>
            <Link href="/products" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] transition-colors">
              All Products
            </Link>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Categories</p>
            {rootCategories.map((cat) => {
              const children = orderedCategories.filter(c => (c as any).parentId === cat.id);
              return (
                <div key={cat.id} className="space-y-0.5">
                  <Link href={`/products?category=${cat.slug}`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      {getCategoryIcon(cat)} 
                    </div>
                    {cat.name}
                  </Link>
                  <div className="flex flex-col gap-0.5 ml-7 pl-3 border-l-2 border-border/40 mt-0.5">
                    {children.map(child => (
                      <Link key={child.id} href={`/products?category=${child.slug}`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {!isAuthenticated && (
            <div className="flex flex-col gap-3 mt-auto pt-6 pb-2 border-t border-border">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl"
                onClick={() => (window.location.href = getLoginUrl(location))}
              >
                Sign In
              </Button>
              <Button
                className="w-full bg-[var(--brand)] text-white hover:opacity-90 h-11 rounded-xl shadow-md"
                onClick={() => (window.location.href = getLoginUrl(location, "register"))}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </div>
      </header>

      {/* Floating AI Chat Card */}
      {aiChatOpen && (
        <div 
          className={`fixed bottom-6 right-6 z-[100] transition-opacity duration-300 chat-widget ${isPageScrolling ? 'opacity-50' : 'opacity-100'}`}
          style={{ "--chat-x": `${chatPosition.x}px`, "--chat-y": `${chatPosition.y}px` } as React.CSSProperties}
        >
          <div className="w-80 sm:w-96 h-[32rem] bg-card border border-border shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
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
                  <p className="text-[0.7rem] text-muted-foreground font-medium">Shopping Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-foreground transition-colors" onClick={handleNewChat} title="New Chat" aria-label="New Chat">
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[var(--brand)]/10 text-muted-foreground hover:text-foreground transition-colors" onClick={() => toast.info("Deep search coming soon!")} title="Search Chat History" aria-label="Search Chat History">
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

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gradient-to-b from-background/50 to-background" ref={chatScrollRef}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 flex-shrink-0`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] ${
                    msg.role === 'user' 
                      ? 'rounded-2xl rounded-tr-md bg-[var(--brand)] text-white shadow-md' 
                      : 'rounded-2xl rounded-tl-md bg-muted text-foreground shadow-sm'
                  } px-4 py-3 break-words whitespace-normal`}>
                    <div className={`text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'font-medium' : 'font-normal'}`}>
                      {msg.role === 'assistant' ? (
                        <>
                          {streamingMessageIndex === i ? (
                            <TypewriterText text={msg.content} onComplete={() => setStreamingMessageIndex(null)} renderContent={renderMessageContent} />
                          ) : renderMessageContent(msg.content)}
                          
                          {/* Generative UI: Product Cards */}
                          {msg.products && msg.products.length > 0 && streamingMessageIndex !== i && (
                            <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-3 animate-in fade-in duration-500">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recommended</p>
                              <div className="flex overflow-x-auto gap-3 pb-2 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {msg.products.map((p: any) => (
                                  <Link key={p.id} href={`/products/${p.slug}`} onClick={() => setAiChatOpen(false)} className="flex-shrink-0 w-36 bg-background rounded-xl p-2.5 snap-start shadow-sm border border-border/50 hover:border-[var(--brand)] hover:shadow-md transition-all group">
                                    <div className="w-full h-24 bg-muted/50 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                      {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <Package className="w-6 h-6 text-muted-foreground/50" />}
                                    </div>
                                    <p className="text-[11px] font-semibold truncate text-foreground" title={p.name}>{p.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{p.brand || "Standard"}</p>
                                    <p className="text-[12px] font-bold text-[var(--brand)] mt-1">{formatPrice(p.price)}</p>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant' && !aiMutation.isPending && !searchHistoryQuery && (
                <div className="flex flex-col gap-2 mt-2 flex-shrink-0 animate-in fade-in duration-300">
                  <p className="text-[0.75rem] text-muted-foreground font-semibold uppercase tracking-wider px-1">Suggested for you</p>
                  <div className="flex flex-wrap gap-2">
                    {(dynamicSuggestions.length > 0 ? dynamicSuggestions : customerSuggestedPrompts).map(prompt => (
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

            {/* Input Area */}
            <div className="px-4 py-3 border-t border-border/50 bg-background/80 backdrop-blur-sm flex-shrink-0">
              <form className="flex gap-2" onSubmit={handleAiSubmit}>
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    aria-label="Chat input" 
                    placeholder={isListening ? "Listening..." : "Ask about our laptops..."} 
                    className="w-full h-10 pl-3.5 pr-9 text-sm rounded-lg border border-input/60 bg-background hover:border-input focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 focus:border-[var(--brand)] transition-all placeholder:text-muted-foreground/50" 
                  />
                  <button 
                    type="button" 
                    onClick={toggleListening} 
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors p-1 rounded hover:bg-muted/50 ${isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-foreground'}`} 
                    title="Voice Search"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <Button 
                  type="submit" 
                  size="sm" 
                  className="bg-[var(--brand)] text-white hover:opacity-90 h-10 px-4 rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={!chatInput.trim() || aiMutation.isPending}
                >
                  Send
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
