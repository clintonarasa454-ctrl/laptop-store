import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Maximize2, Minimize2, Send, BrainCircuit, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpc } from "@/lib/trpc"; // Adjust import based on your setup

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hi! I'm your AI shopping assistant. How can I help you find the perfect product today?" }
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([
    "What's the best laptop for programming?",
    "Show me some gaming laptops",
    "I'm looking for a budget option under 50K"
  ]);

  // Fetch AI settings to check if enabled
  const { data: aiSettings } = trpc.settings.public.useQuery({ keys: ["ai"] });
  const isAIEnabled = aiSettings?.ai?.enabled !== false;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setSuggestions(data.suggestions || []);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now." }]);
      setSuggestions([]);
    }
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setSuggestions([]); // Clear suggestions while waiting for the AI to reply

    chatMutation.mutate({
      message: text,
      history: messages, // Send history for context
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Don't render the chat widget if AI is disabled
  if (!isAIEnabled) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-105 transition-all duration-300"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 dark:bg-gray-950 dark:border dark:border-gray-800
      ${
        isExpanded
          ? "bottom-4 right-4 left-4 top-4 md:bottom-10 md:right-10 md:left-10 md:top-10" // Fullscreen mode
          : "bottom-6 right-6 h-[600px] w-[400px]" // Minimized mode
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5" />
          <h3 className="font-bold">AI Shopping Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg p-1 hover:bg-white/20 transition-colors"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 scroll-smooth">
        <div className="space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white shadow-sm border border-gray-100 text-gray-800 rounded-bl-none dark:bg-gray-950 dark:border-gray-800 dark:text-gray-200"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-table:w-full prose-th:bg-gray-50 dark:prose-th:bg-gray-800/50 prose-th:p-2 prose-td:p-2 prose-td:border-t prose-td:border-gray-100 dark:prose-td:border-gray-800 prose-a:text-blue-600">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-none px-5 py-4 dark:bg-gray-950 dark:border-gray-800">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            </div>
          )}
          
          {suggestions.length > 0 && !chatMutation.isPending && (
            <div className="flex flex-wrap gap-2 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-blue-200 bg-blue-50/50 px-4 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 text-left shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a product, budget, or feature..."
            className="w-full rounded-full border border-gray-300 bg-gray-50 py-3 pl-5 pr-14 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
            disabled={chatMutation.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || chatMutation.isPending}
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-700"
          >
            <Send className="h-4 w-4 -ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}