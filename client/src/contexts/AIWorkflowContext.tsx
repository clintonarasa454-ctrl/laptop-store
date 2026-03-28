import { createContext, useState, useContext, ReactNode } from 'react';

export type RecordedAction =
  | {
      type: 'navigate';
      payload: { path: string };
      description: string;
    }
  | {
      type: 'click';
      payload: { selector: string };
      description: string;
    };

interface AIWorkflowContextType {
  isRecording: boolean;
  recordedActions: RecordedAction[];
  startRecording: () => void;
  stopRecording: () => void;
  logAction: (action: RecordedAction) => void;
  clearActions: () => void;
}

const AIWorkflowContext = createContext<AIWorkflowContextType | undefined>(undefined);

export const AIWorkflowProvider = ({ children }: { children: ReactNode }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedActions, setRecordedActions] = useState<RecordedAction[]>([]);

  const startRecording = () => {
    setRecordedActions([]);
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const logAction = (action: RecordedAction) => {
    if (isRecording) {
      setRecordedActions(prev => [...prev, action]);
    }
  };
  
  const clearActions = () => {
    setRecordedActions([]);
  }

  return (
    <AIWorkflowContext.Provider value={{ isRecording, recordedActions, startRecording, stopRecording, logAction, clearActions }}>
      {children}
    </AIWorkflowContext.Provider>
  );
};

export const useAIWorkflow = () => {
  const context = useContext(AIWorkflowContext);
  if (context === undefined) {
    throw new Error('useAIWorkflow must be used within a AIWorkflowProvider');
  }
  return context;
};