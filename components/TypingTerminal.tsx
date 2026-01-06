import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface TypingTerminalRef {
  setText: (text: string) => void;
  setComplete: (complete: boolean) => void;
}

interface TypingTerminalProps {
  language: string;
  isGenerating: boolean;
  placeholder?: string;
}

export const TypingTerminal = forwardRef<TypingTerminalRef, TypingTerminalProps>(({ language, isGenerating, placeholder }, ref) => {
  const [text, setText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setText: (newText: string) => setText(newText),
    setComplete: (complete: boolean) => setIsComplete(complete)
  }));

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current && text) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div 
      ref={containerRef}
      className="w-full flex-1 p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-200 font-mono text-sm rounded-lg overflow-auto custom-scrollbar border-2 border-amber-500/30"
    >
      <div className="whitespace-pre-wrap">
        {text || placeholder || (language === 'pt' ? 'Aguardando...' : 'Waiting...')}
        {isGenerating && !isComplete && (
          <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-1 align-middle"></span>
        )}
      </div>
    </div>
  );
});
