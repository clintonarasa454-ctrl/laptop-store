import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Upload, X, Loader2, Sparkles, FileText, Bot, Play, Square, Trash2, Workflow } from "lucide-react";
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

  const utils = trpc.useUtils();
  const updateSetting = trpc.admin.updateSetting.useMutation();
  const createPresignedUrl = trpc.admin.createPresignedUrl.useMutation();
  const { data: dbSettings } = trpc.admin.getSetting.useQuery({ key: "ai" });

  // Workflow features are disabled - not available in backend
  // const { data: workflows, refetch: refetchWorkflows } = trpc.admin.listAiWorkflows.useQuery();
  // const saveWorkflow = trpc.admin.saveAiWorkflow.useMutation();
  // const deleteWorkflow = trpc.admin.deleteAiWorkflow.useMutation();

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

  const { data: dbKnowledge } = trpc.admin.getSetting.useQuery({ key: "ai_knowledge" });
  useEffect(() => {
    if (dbKnowledge !== undefined) {
      setAiKnowledge((dbKnowledge as string) || "");
    }
  }, [dbKnowledge]);

  const handleSave = async () => {
    try {
      await updateSetting.mutateAsync({ key: "ai", value: aiSettings });
      utils.admin.getSetting.invalidate({ key: "ai" });
      toast.success("AI settings saved successfully");
    } catch (error) {
      toast.error("Failed to save AI settings");
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

  // Workflow save/delete disabled - endpoints not available
  // const handleStopAndSave = async () => {
  //   if (!workflowName.trim()) {
  //     toast.error("Please enter a name for the workflow.");
  //     return;
  //   }
  //   stopRecording();
  //   try {
  //     await saveWorkflow.mutateAsync({ name: workflowName, actions: recordedActions });
  //     toast.success(`Workflow "${workflowName}" saved successfully!`);
  //     setWorkflowName("");
  //     clearActions();
  //     refetchWorkflows();
  //   } catch (error) {
  //     toast.error("Failed to save workflow. The name might already exist.");
  //   }
  // };

  // const handleDeleteWorkflow = async (id: number, name: string) => {
  //   if (confirm(`Are you sure you want to delete the "${name}" workflow? This cannot be undone.`)) {
  //     try {
  //       await deleteWorkflow.mutateAsync({ id });
  //       toast.success(`Workflow "${name}" deleted.`);
  //       refetchWorkflows();
  //     } catch (error) {
  //       toast.error("Failed to delete workflow.");
  //     }
  //   }
  // };

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
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea
                id="system-prompt"
                value={aiSettings.systemPrompt}
                onChange={(e) => setAiSettings({ ...aiSettings, systemPrompt: e.target.value })}
                rows={8}
                placeholder="Define the AI's personality, role, and instructions..."
              />
              <p className="text-xs text-muted-foreground">
                This is the core instruction set for the AI. It sets the behavior across all panels (Customer, Admin, Driver).
              </p>
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
                  {recordedActions.length > 0 ? recordedActions.map((action, i) => <p key={i}>{i+1}. {action.description}</p>) : <p>Waiting for actions...</p>}
                </div>
                <Button onClick={() => { stopRecording(); toast.info("Workflow recording stopped."); }} variant="destructive" className="w-full gap-2" disabled>
                  {<Square size={18} />}
                  Stop Recording & Save Workflow (Disabled)
                </Button>
              </div>
            ) : (
              <Button onClick={handleStartRecording} className="w-full gap-2">
                <Play size={18} /> Start New Workflow Recording
              </Button>
            )}

            {/* Workflow features disabled - endpoints not available */}
            <div className="pt-4 border-t border-border">
              <h4 className="font-semibold mb-3 text-muted-foreground">Saved Workflows (Disabled)</h4>
              <p className="text-sm text-muted-foreground text-center py-4">Workflow management is not available yet.</p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}