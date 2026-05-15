import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Save, Upload, X, Loader2, Sparkles, FileText, Bot, Play, Square, Trash2, Workflow, Mail, Send, TrendingUp, Package, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAIWorkflow } from "@/contexts/AIWorkflowContext";

export default function AdminAI() {
  const [aiSettings, setAiSettings] = useState({
    model: "gpt-4o-mini",
    systemPrompt: "You are a helpful e-commerce assistant for the admin panel of this online store. Your goal is to help the admin manage the store efficiently. You can answer questions about orders, products, and customers by interpreting the user's request and providing concise information. When asked for data, you should state that you are fetching it. You have access to the admin's context, such as which page they are on.",
    knowledgeBaseFiles: [] as string[],
  });

  // Workflow state
  const { isRecording, recordedActions, startRecording, stopRecording, clearActions } = useAIWorkflow();
  const [workflowName, setWorkflowName] = useState("");
  const [aiKnowledge, setAiKnowledge] = useState("");
  
  const [inventorySettings, setInventorySettings] = useState({
    lowStockThreshold: "5",
    notifyAdmin: true,
    adminEmail: "",
  });

  // Persist workflows using settings DB
  const [workflows, setWorkflows] = useState<any[]>([]);

  const utils = trpc.useUtils();
  const updateSetting = trpc.admin.updateSetting.useMutation();
  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();
  const { data: dbSettings } = trpc.admin.getSetting.useQuery({ key: "ai" });

  const { data: trendingProducts, isLoading: isTrendingLoading } = trpc.analytics.demandPrediction.useQuery({ daysBack: 7 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dbSettings) {
      setAiSettings(prev => {
        const loaded = { ...prev, ...(dbSettings as any) };
        if (typeof loaded.systemPrompt === "string") {
          loaded.systemPrompt = loaded.systemPrompt.replace(/\bNexus\b/gi, "our");
        }
        return loaded;
      });
    }
  }, [dbSettings]);

  const { data: dbWorkflows } = trpc.admin.getSetting.useQuery({ key: "ai_workflows" });
  useEffect(() => {
    if (dbWorkflows && Array.isArray(dbWorkflows)) {
      setWorkflows(dbWorkflows);
    }
  }, [dbWorkflows]);

  const { data: dbKnowledge } = trpc.admin.getSetting.useQuery({ key: "ai_knowledge" });
  useEffect(() => {
    if (dbKnowledge !== undefined) {
      setAiKnowledge((dbKnowledge as string) || "");
    }
  }, [dbKnowledge]);

  const { data: dbInventory } = trpc.admin.getSetting.useQuery({ key: "inventory" });
  useEffect(() => {
    if (dbInventory) {
      setInventorySettings(prev => JSON.stringify(prev) === JSON.stringify(dbInventory) ? prev : (dbInventory as any));
    }
  }, [dbInventory]);

  const handleSave = async () => {
    try {
      await updateSetting.mutateAsync({ key: "ai", value: aiSettings });
      utils.admin.getSetting.invalidate({ key: "ai" });
      utils.settings.public.invalidate();
      toast.success("AI settings saved successfully");
    } catch (error) {
      toast.error("Failed to save AI settings");
    }
  };

  const handleSaveInventory = async () => {
    try {
      await updateSetting.mutateAsync({ key: "inventory", value: inventorySettings });
      utils.admin.getSetting.invalidate({ key: "inventory" });
      toast.success("Inventory settings saved successfully");
    } catch (error) {
      toast.error("Failed to save inventory settings");
    }
  };

  const handleSaveKnowledge = async () => {
    try {
      await updateSetting.mutateAsync({ key: "ai_knowledge", value: aiKnowledge });
      utils.admin.getSetting.invalidate({ key: "ai_knowledge" });
      toast.success("Structured Memory saved successfully");
    } catch (error) {
      toast.error("Failed to save memory");
    }
  };

  const trainAiMutation = trpc.admin.trainAiOnDocument.useMutation({
    onSuccess: () => {
      toast.success("AI successfully trained on document!");
      utils.admin.getSetting.invalidate({ key: "ai_knowledge" });
    },
    onError: (err) => toast.error(err.message)
  });

  const broadcastTrendingMutation = trpc.admin.broadcastTrendingProducts.useMutation({
    onSuccess: (data) => toast.success(`Successfully sent trending emails to ${data.sentCount} customers!`),
    onError: (err) => toast.error(`Failed to send emails: ${err.message}`)
  });

  const triggerRestock = trpc.admin.triggerAutoRestock.useMutation({
    onSuccess: () => toast.success("Auto-restock check triggered successfully! Check your email."),
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit for knowledge files
        toast.error(`${file.name} is larger than 5MB.`);
        continue;
      }
      let toastId;
      try {
        toastId = toast.loading(`Uploading ${file.name}...`);
        const { uploadUrl, publicUrl } = await createPresignedUrl.mutateAsync({ filename: file.name, contentType: file.type });

        if (uploadUrl && publicUrl) {
          const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          if (!res.ok) throw new Error("S3 Upload Failed");
          newFiles.push(publicUrl);
          toast.success(`${file.name} uploaded!`, { id: toastId });
        } else {
          throw new Error("Failed to get presigned URL");
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`, { id: toastId });
      }
    }

    if (newFiles.length > 0) {
      setAiSettings(prev => ({ ...prev, knowledgeBaseFiles: [...prev.knowledgeBaseFiles, ...newFiles] }));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAiSettings(prev => ({
      ...prev,
      knowledgeBaseFiles: prev.knowledgeBaseFiles.filter((_, i) => i !== index),
    }));
  };

  const handleStartRecording = () => {
    startRecording();
    toast.info("AI workflow recording started. Perform the actions you want the AI to learn.");
  };

  const handleStopAndSave = async () => {
    if (!workflowName.trim()) {
      toast.error("Please enter a name for the workflow.");
      return;
    }
    stopRecording();
    const newWorkflow = { id: Date.now(), name: workflowName, actions: recordedActions, createdAt: new Date().toISOString() };
    const updated = [...workflows, newWorkflow];
    setWorkflows(updated);
    await updateSetting.mutateAsync({ key: "ai_workflows", value: updated });
    toast.success(`Workflow "${workflowName}" saved successfully!`);
    setWorkflowName("");
    clearActions();
  };

  const handleDeleteWorkflow = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete the "${name}" workflow? This cannot be undone.`)) {
      const updated = workflows.filter(w => w.id !== id);
      setWorkflows(updated);
      await updateSetting.mutateAsync({ key: "ai_workflows", value: updated });
      toast.success(`Workflow "${name}" deleted.`);
    }
  };

  return (
    <AdminLayout activeTab="ai">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-[var(--brand)]" /> AI Assistant Settings
            </h2>
            <p className="text-muted-foreground mt-1">
              Configure and train your AI-powered admin assistant to better serve your business.
            </p>
          </div>
          <div className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 text-xs font-bold uppercase tracking-widest">
            AI Active
          </div>
        </div>

        <Card className="p-6 md:p-8">
          <div className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="ai-model">AI Model</Label>
              <Select value={aiSettings.model} onValueChange={(val) => setAiSettings({ ...aiSettings, model: val })}>
                <SelectTrigger id="ai-model" className="w-full md:w-1/2">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o (Most Advanced)</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast & Efficient)</SelectItem>
                  <SelectItem value="grok-4-1-fast">Grok 4.1 Fast (x.ai)</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="system-prompt" className="text-lg font-semibold">System Prompt</Label>
                  <p className="text-sm text-muted-foreground mt-1">This is the core instruction set for the AI. It sets the behavior across all panels.</p>
                </div>
                <Button onClick={handleSave} size="sm" className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Prompt
                </Button>
              </div>
              <Textarea
                id="system-prompt"
                value={aiSettings.systemPrompt}
                onChange={(e) => setAiSettings({ ...aiSettings, systemPrompt: e.target.value })}
                rows={8}
                placeholder="Define the AI's personality, role, and instructions..."
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[10px] font-mono bg-muted px-2 py-1 rounded text-muted-foreground">Context Variables Automatically Injected:</span>
                <span className="text-[10px] font-mono bg-[var(--brand)]/10 text-[var(--brand)] px-2 py-1 rounded border border-[var(--brand)]/20">{`{{Page Context}}`}</span>
                <span className="text-[10px] font-mono bg-[var(--brand)]/10 text-[var(--brand)] px-2 py-1 rounded border border-[var(--brand)]/20">{`{{Cart Data}}`}</span>
                <span className="text-[10px] font-mono bg-[var(--brand)]/10 text-[var(--brand)] px-2 py-1 rounded border border-[var(--brand)]/20">{`{{User Details}}`}</span>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <div>
                <Label className="text-lg font-semibold">Knowledge Base</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload documents or text images (e.g., store return policies, manuals, FAQs) for the AI to reference when answering questions.
                </p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {aiSettings.knowledgeBaseFiles.map((fileUrl, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border group bg-muted/30">
                    <img src={fileUrl} alt={`Knowledge ${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2 gap-2">
                      <Button size="sm" variant="outline" className="h-7 w-full text-[10px]" onClick={() => trainAiMutation.mutate({ fileUrl, fileName: `Document_${idx}` })} disabled={trainAiMutation.isPending}>
                        Train
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 w-full text-[10px]" onClick={() => removeFile(idx)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-md border-2 border-dashed border-border hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Upload</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-lg font-semibold">Structured Memory</Label>
                  <p className="text-sm text-muted-foreground mt-1">This is the analyzed data extracted from your trained documents. The AI reads this to answer customer questions.</p>
                </div>
                <Button onClick={handleSaveKnowledge} size="sm" className="gap-2" disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </Button>
              </div>
              <Textarea value={aiKnowledge} onChange={(e) => setAiKnowledge(e.target.value)} rows={8} placeholder="Upload and train documents above to populate this, or type manual facts here (e.g. Return policies, delivery times)..." />
            </div>

            <Button onClick={handleSave} className="gap-2" disabled={updateSetting.isPending}>
              {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save AI Settings
            </Button>
          </div>
        </Card>

        <Card className="p-6 md:p-8 mt-6">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Package className="w-6 h-6 text-[var(--brand)]" /> AI Auto-Restock Notifications
                </h3>
                <p className="text-muted-foreground mt-1">
                  Managers automatically receive auto-restock alerts. Configure admin notifications below.
                </p>
              </div>
              <Button onClick={() => triggerRestock.mutate()} disabled={triggerRestock.isPending} variant="outline" className="gap-2 hidden sm:flex">
                {triggerRestock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Test Restock Check
              </Button>
            </div>

            <div className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label htmlFor="low-stock-threshold">Low Stock Threshold</Label>
                <p className="text-sm text-muted-foreground">Trigger an AI auto-restock email when stock falls below this number.</p>
                <Input id="low-stock-threshold" type="number" min="0" value={inventorySettings.lowStockThreshold} onChange={(e) => setInventorySettings({ ...inventorySettings, lowStockThreshold: e.target.value })} />
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                <div>
                  <Label htmlFor="notify-admin" className="text-base font-medium">Send Alerts to Admin</Label>
                  <p className="text-sm text-muted-foreground">Toggle whether the admin should receive auto-restock emails.</p>
                </div>
                <input type="checkbox" id="notify-admin" checked={inventorySettings.notifyAdmin} onChange={(e) => setInventorySettings({ ...inventorySettings, notifyAdmin: e.target.checked })} className="w-5 h-5 accent-[var(--brand)] cursor-pointer" />
              </div>
            </div>

            <Button onClick={handleSaveInventory} className="gap-2" disabled={updateSetting.isPending}>
              {updateSetting.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Inventory Settings
            </Button>
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Bot className="w-6 h-6 text-[var(--brand)]" /> Workflow Training
              </h3>
              <p className="text-muted-foreground mt-1">
                Record your actions to teach the AI how to perform common tasks. The AI can then describe these steps when asked.
              </p>
            </div>

            {isRecording ? (
              <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <div className="w-2 h-2 rounded-full bg-destructive animate-ping" />
                    Recording Actions...
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workflow-name">Workflow Name</Label>
                  <Input id="workflow-name" placeholder="e.g., 'How to add a new product'" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} />
                </div>
                <div className="max-h-40 overflow-y-auto bg-background/50 p-3 rounded-md border border-border text-xs space-y-1.5 font-mono text-muted-foreground">
                  {recordedActions.length > 0 ? recordedActions.map((action, i) => <p key={i}>{i + 1}. {action.description}</p>) : <p>Waiting for actions...</p>}
                </div>
                <Button onClick={handleStopAndSave} variant="destructive" className="w-full gap-2" disabled={recordedActions.length === 0}>
                  <Square size={18} />
                  Stop Recording & Save Workflow
                </Button>
              </div>
            ) : (
              <Button onClick={handleStartRecording} className="w-full gap-2">
                <Play size={18} /> Start New Workflow Recording
              </Button>
            )}

            <div className="pt-4 border-t border-border">
              <h4 className="font-semibold mb-3 text-foreground">Saved Workflows</h4>
              {workflows.length > 0 ? (
                <div className="space-y-3">
                  {workflows.map((wf) => (
                    <div key={wf.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/30">
                      <div>
                        <p className="font-medium text-sm">{wf.name}</p>
                        <p className="text-xs text-muted-foreground">{wf.actions?.length || 0} steps recorded</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteWorkflow(wf.id, wf.name)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No workflows saved yet. Record one above.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6 md:p-8 mt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Mail className="w-6 h-6 text-[var(--brand)]" /> Email Marketing Campaigns
              </h3>
              <p className="text-muted-foreground mt-1">
            Automatically fetch fast-moving and high-demand products from the database and broadcast an email to your customers encouraging them to shop with unique 15% off discount codes.
              </p>
            </div>

        <div className="bg-muted/30 p-4 rounded-lg border border-border mb-6">
          <h4 className="font-semibold flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-orange-500" /> Fast-Moving Products (Last 7 Days)
          </h4>
          {isTrendingLoading ? (
             <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : trendingProducts && trendingProducts.length > 0 ? (
            <ul className="space-y-2">
              {trendingProducts.slice(0, 3).map((p: any) => (
                <li key={p.productId} className="text-sm flex justify-between p-2 bg-background rounded border border-border">
                  <span className="font-medium">{p.productName}</span>
                  <span className="text-muted-foreground text-xs bg-orange-500/10 text-orange-600 px-2 py-1 rounded-full">{p.salesCount} sold recently</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No trending products found.</p>
          )}
        </div>

            <Button
              onClick={() => broadcastTrendingMutation.mutate()}
              disabled={broadcastTrendingMutation.isPending}
              className="gap-2 bg-[var(--brand)] text-white hover:opacity-90"
            >
              {broadcastTrendingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Trending Products Email
            </Button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}