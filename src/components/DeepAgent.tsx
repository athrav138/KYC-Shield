import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, GripHorizontal, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

const getFriendlyErrorMessage = (err: any): string => {
  const msg = err?.message || '';
  if (msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API Rate Limit Exceeded. Please wait a moment and try again.';
  }
  if (msg.includes('API key not valid')) {
    return 'Invalid API Key. Please check your configuration.';
  }
  return msg || "I'm having trouble connecting right now. Please try again later.";
};

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const DeepAgent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hello! I'm Deep Agent, your guide to Deepfake KYC Buster. How can I help you today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is not configured");
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: messages.concat({ role: 'user', text: userMessage }).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: `You are "Deep Agent", the official AI assistant for Deepfake KYC Buster.
          
          Knowledge Base:
          - Deepfake KYC Buster: A next-gen identity platform that uses advanced AI to detect deepfakes, spoofing, and tampered documents during the KYC (Know Your Customer) process.
          - Why use it: To prevent identity fraud, protect businesses from synthetic identity attacks, and ensure robust verification in the age of AI-generated fakes. It's essential for security-conscious fintechs and banks.
          - Capabilities: 
            1. Aadhaar OCR & Tampering Detection: Extracts data and checks for fake fonts or inconsistent layouts.
            2. Face Liveness Verification: Uses micro-movement detection (blinking, smiling, head turns) to ensure a real human is present, not a photo or video replay.
            3. Voice Authentication: Analyzes speech patterns to detect synthetic voices.
            4. Real-time Risk Scoring: Provides instant feedback on user authenticity.
          - Use Cases: Fintech onboarding, banking, crypto exchanges, remote employee verification, and any high-security digital identity scenario.
          
          Tone: Professional, helpful, secure, and tech-forward.
          Keep responses concise and informative.`,
        }
      });

      const text = response.text || "I'm sorry, I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error: any) {
      console.error("Deep Agent Error:", error);
      const errorMessage = getFriendlyErrorMessage(error);
      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 sm:w-96 bg-app-card border border-app-border rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px]"
          >
            {/* Header */}
            <div className="p-4 border-b border-app-border bg-emerald-500/10 flex items-center justify-between cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Deep Agent</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] opacity-50 uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <GripHorizontal className="w-5 h-5 opacity-20" />
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-app-text/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
            >
              {messages.map((m, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl text-sm",
                    m.role === 'user' 
                      ? "bg-emerald-500 text-black font-medium rounded-tr-none" 
                      : "bg-app-bg border border-app-border rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-invert prose-sm max-w-none">
                      <Markdown>{m.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs opacity-40">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Deep Agent is thinking...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-app-border bg-app-bg/50">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about KYC Buster..."
                  className="flex-1 bg-app-card border border-app-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95",
          isOpen ? "bg-red-500 text-white" : "bg-emerald-500 text-black"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </div>
  );
};
