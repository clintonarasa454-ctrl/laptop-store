﻿import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function MarketingBroadcastButton() {
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [isSendingRestock, setIsSendingRestock] = useState(false);
  
  const broadcastMutation = trpc.admin.broadcastTrendingProducts.useMutation({
    onSuccess: (data) => {
      toast.success(`Successfully sent fast-selling product emails to `+data.sentCount+` customers!`);
      setIsSendingBroadcast(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send broadcast");
      setIsSendingBroadcast(false);
    }
  });

  const campaignMutation = trpc.admin.triggerAIMarketing.useMutation({
    onSuccess: (data) => {
      toast.success(`Successfully sent personalized AI emails to `+data.sentCount+` customers!`);
      setIsSendingCampaign(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to trigger AI campaign");
      setIsSendingCampaign(false);
    }
  });

  const restockMutation = trpc.admin.triggerAutoRestock.useMutation({
    onSuccess: () => {
      toast.success("Successfully triggered AI Auto-Restock check! Check your email.");
      setIsSendingRestock(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to trigger AI Auto-Restock");
      setIsSendingRestock(false);
    }
  });

  const handleSendBroadcast = () => {
    if (window.confirm("Are you sure you want to email your customers the latest fast-selling products?")) {
      setIsSendingBroadcast(true);
      broadcastMutation.mutate();
    }
  };

  const handleTriggerCampaign = () => {
    if (window.confirm("Are you sure you want to manually trigger the personalized AI email campaign?")) {
      setIsSendingCampaign(true);
      campaignMutation.mutate();
    }
  };

  const handleTriggerRestock = () => {
    if (window.confirm("Are you sure you want to trigger the AI Auto-Restock check now?")) {
      setIsSendingRestock(true);
      restockMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      <button 
        onClick={handleSendBroadcast} 
        disabled={isSendingBroadcast}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {isSendingBroadcast ? "Sending Broadcast..." : "📢 Email Fast Selling Products"}
      </button>

      <button 
        onClick={handleTriggerCampaign} 
        disabled={isSendingCampaign}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {isSendingCampaign ? "Sending AI Emails..." : "✨ AI Personalized Email Campaign"}
      </button>

      <button 
        onClick={handleTriggerRestock} 
        disabled={isSendingRestock}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {isSendingRestock ? "Checking Stock..." : "📦 Test AI Auto-Restock"}
      </button>
    </div>
  );
}
