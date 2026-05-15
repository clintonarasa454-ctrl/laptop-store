import React, { useState } from "react";
import { trpc } from "../lib/trpc";
import { AlertCircle, CheckCircle, FileText, Send } from "lucide-react";

export default function AppealPage() {
  // Extract the JWT token from the URL query parameters (?token=...)
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");
  
  const [appealText, setAppealText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  
  const submitAppeal = trpc.appeals.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    }
  });
  
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-200">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-600">The appeal link you clicked is invalid or missing the required token. Your appeal window may have expired.</p>
        </div>
      </div>
    );
  }
  
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-200">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Appeal Submitted</h2>
          <p className="text-gray-600">
            Your appeal has been successfully submitted and is pending review by the administration. 
            You will be notified via email regarding the final decision.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Submit a Formal Appeal</h2>
            <p className="text-sm text-red-600 mt-1">
              Provide your defense regarding your recent dismissal.
            </p>
          </div>
        </div>
        
        <form 
          className="p-6 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submitAppeal.mutate({ token, appealText });
          }}
        >
          {submitAppeal.isError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2 border border-red-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{submitAppeal.error?.message || "Failed to submit appeal. Ensure you are within the 3-day window."}</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Why do you believe this dismissal was unjustified? Please provide any relevant details, context, or evidence.
            </label>
            <textarea
              required
              rows={7}
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              placeholder="State your case clearly here..."
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-3 border text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-2">
              Note: You can only submit this form once. Ensure all your details are correct before sending.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={submitAppeal.isPending || !appealText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitAppeal.isPending ? (
              "Submitting your appeal..."
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Appeal for Review
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}