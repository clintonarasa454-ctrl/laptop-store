import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DeletionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "product" | "category" | "banner" | "promotion" | "announcement" | "driver" | "vehicle" | "brand";
  itemId: string;
  itemName: string;
}

export function DeletionRequestModal({ isOpen, onClose, itemType, itemId, itemName }: DeletionRequestModalProps) {
  const [reason, setReason] = useState("");
  const requestMutation = trpc.admin.requestDeletion.useMutation({
    onSuccess: () => {
      toast.success("Deletion request sent to admin for approval.");
      setReason("");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!reason.trim()) return;
    requestMutation.mutate({ itemType, itemId, itemName, reason });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Deletion Authorization</DialogTitle>
          <DialogDescription>
            As a manager, you must provide a reason to delete <span className="font-bold text-foreground">{itemName}</span>. An admin will review this request.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Reason for deletion..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit} 
            disabled={!reason.trim() || requestMutation.isPending}
          >
            {requestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}