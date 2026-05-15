import React, { useState } from "react";
import { trpc } from "../lib/trpc";
import { AlertTriangle, CheckCircle, XCircle, FileText, User } from "lucide-react";

export default function AdminAppeals() {
  // Note: Depending on your tRPC v10 setup, you might use trpc.useUtils() instead of trpc.useContext()
  const utils = trpc.useContext ? trpc.useContext() : (trpc as any).useUtils();
  const { data: appeals, isLoading } = trpc.appeals.getPendingAppeals.useQuery();
  
  const reviewAppeal = trpc.appeals.review.useMutation({
    onSuccess: () => {
      utils.appeals.getPendingAppeals.invalidate();
    }
  });
  
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  
  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        Loading pending appeals...
      </div>
    );
  }
  
  if (!appeals || appeals.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Pending Appeals</h3>
          <p className="text-gray-500">You're all caught up! There are currently no dismissal appeals awaiting your review.</p>
        </div>
      </div>
    );
  }
  
  const handleReview = (appeal: any, accept: boolean) => {
    if (!window.confirm(`Are you sure you want to ${accept ? 'ACCEPT' : 'REJECT'} this appeal? This action cannot be undone.`)) return;
    
    reviewAppeal.mutate({
      type: appeal.type,
      id: appeal.id,
      accept,
      adminNotes: adminNotes.trim() || undefined
    });
    setReviewingId(null);
    setAdminNotes("");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            Dismissal Appeals
          </h1>
          <p className="text-gray-600 mt-1">Review defenses submitted by suspended drivers and managers.</p>
        </div>
        <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
          {appeals.length} Pending
        </div>
      </div>
      
      <div className="space-y-6">
        {appeals.map((appeal: any) => {
          const compositeId = `${appeal.type}_${appeal.id}`;
          const isReviewing = reviewingId === compositeId;
          
          return (
            <div key={compositeId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200 p-4 bg-gray-50 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{appeal.name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                      <span className="capitalize px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold border border-indigo-100">
                        {appeal.type}
                      </span>
                      <span>&bull; {appeal.email}</span>
                      <span>&bull; Fired on {new Date(appeal.firedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-4 w-4" /> Reason for Dismissal
                  </h4>
                  <p className="text-gray-800 bg-red-50 p-4 rounded-lg text-sm border border-red-100 whitespace-pre-wrap">
                    {appeal.reason}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5 mb-2">
                    <FileText className="h-4 w-4" /> Employee's Defense
                  </h4>
                  <p className="text-gray-800 bg-blue-50 p-4 rounded-lg text-sm border border-blue-100 italic whitespace-pre-wrap">
                    "{appeal.appealText}"
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                {isReviewing ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Admin Feedback / Notes <span className="text-gray-400 font-normal">(Sent via email regarding the decision)</span>
                      </label>
                      <textarea 
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Explain the final decision..."
                        className="w-full rounded-md border border-gray-300 p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-3 justify-end pt-2">
                      <button onClick={() => { setReviewingId(null); setAdminNotes(""); }} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                      <button onClick={() => handleReview(appeal, false)} disabled={reviewAppeal.isPending} className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2">
                        <XCircle className="h-4 w-4" /> Reject (Permanently Delete)
                      </button>
                      <button onClick={() => handleReview(appeal, true)} disabled={reviewAppeal.isPending} className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" /> Accept (Restore Access)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button onClick={() => setReviewingId(compositeId)} className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
                      Review this Appeal
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}