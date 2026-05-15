import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/pages/useAuth";
import { MessageSquare, Send, X, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Helper function to format time consistently
const formatMessageTime = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const today = new Date();
  
  // Check if message is from today
  const isToday = d.toDateString() === today.toDateString();
  const isYesterday = new Date(today.setDate(today.getDate() - 1)).toDateString() === d.toDateString();
  
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  
  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday ${timeStr}`;
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeStr;
  }
};

export const StaffChatModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Fetch contacts (Managers if Admin, Admins if Manager)
  const { data: contacts, isLoading: contactsLoading } = trpc.staffChat.getContacts.useQuery(undefined, {
    enabled: isOpen,
    staleTime: 60000,
  });

  // Fetch messages. We use refetchInterval to poll for new messages every 10 seconds
  const { data: messages, refetch: refetchMessages } = trpc.staffChat.getMessages.useQuery(
    { contactId: selectedContactId! },
    { 
      enabled: isOpen && selectedContactId !== null,
      refetchInterval: 10000 
    }
  );

  const sendMessage = trpc.staffChat.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetchMessages();
    },
    onError: (err) => {
      toast.error("Failed to send message: " + err.message);
    }
  });

  const markAsRead = trpc.staffChat.markAsRead.useMutation({
    onSuccess: () => {
      utils.staffChat.getUnreadCount.invalidate();
      utils.staffChat.getMessages.invalidate();
    }
  });

  // Auto-select the first admin if the user is a manager
  useEffect(() => {
    if (user?.role === "manager" && contacts?.length === 1 && !selectedContactId) {
      setSelectedContactId(contacts[0].id);
    }
  }, [contacts, user, selectedContactId]);

  // Mark messages as read automatically when chat is open and a contact is selected
  useEffect(() => {
    if (isOpen && selectedContactId && messages) {
      const hasUnread = messages.some(msg => msg.senderId === selectedContactId && !msg.isRead);
      if (hasUnread) {
        markAsRead.mutate({ contactId: selectedContactId });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isOpen, selectedContactId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedContactId) return;
    sendMessage.mutate({ receiverId: selectedContactId, content: message });
  };

  // Get selected contact info
  const selectedContact = contacts?.find(c => c.id === selectedContactId);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 w-96 bg-card border border-border shadow-2xl rounded-xl flex flex-col z-50 overflow-hidden h-[700px] animate-in fade-in zoom-in-95 duration-200">
      {/* Header - Dynamic based on view */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          {selectedContactId && (
            <button 
              onClick={() => setSelectedContactId(null)}
              className="hover:text-slate-300 transition-colors p-1"
              title="Back to contacts"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h3 className="font-bold flex items-center gap-2 text-sm">
            {selectedContactId ? (
              <>
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                  <User size={14} />
                </div>
                {selectedContact?.name || selectedContact?.email}
              </>
            ) : (
              <>
                <MessageSquare size={18} />
                Staff Chat
              </>
            )}
          </h3>
        </div>
        <button onClick={onClose} className="hover:text-slate-300 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Contact Selector Sidebar - Hidden when chat selected */}
        {!selectedContactId && (
          <div className="w-full border-r border-border bg-muted/30 overflow-y-auto shrink-0">
            <div className="p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {user?.role === "admin" ? "Managers" : "Admins"}
            </div>
            {contactsLoading && <div className="p-4 text-xs text-center text-muted-foreground">Loading...</div>}
            {contacts?.map(contact => (
              <button
                key={contact.id}
                onClick={() => setSelectedContactId(contact.id)}
                className="w-full text-left p-3 flex items-center gap-2 hover:bg-muted transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <User size={14} />
                </div>
                <span className="text-xs font-medium truncate">{contact.name || contact.email}</span>
              </button>
            ))}
          </div>
        )}

        {/* Chat Area - Full width when selected */}
        {selectedContactId && (
          <div className="flex-1 flex flex-col bg-background min-w-0 w-full">
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-gradient-to-b from-background/50 to-background">
              {messages?.map(msg => {
                const isMine = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} w-full`}>
                    <div className={`max-w-[85%] p-2.5 rounded-2xl text-[13px] break-words whitespace-normal ${isMine ? 'bg-[var(--brand)] text-white rounded-br-sm shadow-md' : 'bg-muted text-foreground rounded-bl-sm shadow-sm'}`}>
                      {msg.content}
                      <div className={`text-[9px] mt-1 flex items-center gap-1 ${isMine ? 'text-white/70 justify-end' : 'text-muted-foreground/70 justify-start'}`}>
                        {formatMessageTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-border/50 bg-background/80 backdrop-blur-sm flex gap-2 flex-shrink-0">
              <Input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." className="flex-1 h-9 text-xs" disabled={sendMessage.isPending} />
              <Button type="submit" size="sm" className="h-9 w-9 p-0 bg-[var(--brand)] text-white shrink-0" disabled={!message.trim() || sendMessage.isPending}>
                <Send size={16} />
              </Button>
            </form>
          </div>
        )}

        {/* Empty state */}
        {!selectedContactId && (
          <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground text-xs p-4 text-center bg-background">
            Select a contact to start chatting
          </div>
        )}
      </div>
    </div>
  );
};