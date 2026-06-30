
import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Video, Bot, User, Trash2, Loader2, Network, Sparkles, X, BrainCircuit } from 'lucide-react';
import { aiChatService, ChatMessage } from '../services/geminiService';
import { useLanguage } from '../services/i18n';

const STORAGE_KEY = 'sentinel_ai_chat_history';
const SETTINGS_KEY = 'sentinel_ai_chat_settings';

export const AIChatView: React.FC = () => {
  const { t, language } = useLanguage();
  
  // Initialize messages from LocalStorage or default to greeting
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
    return [{ role: 'model', text: "Assalomu alaykum, Administrator. Men Sentinel AI – sizning xavfsizlik bo'yicha yordamchingizman. Men jurnallarni tahlil qilishim, xavfsizlik tasvirlarini ko'rib chiqishim yoki tizim haqidagi savollarga javob berishim mumkin. Bugun sizga qanday yordam bera olaman?" }];
  });

  // Initialize thinking mode from LocalStorage
  const [thinkingMode, setThinkingMode] = useState(() => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        return saved ? JSON.parse(saved).thinkingMode : false;
    } catch { return false; }
  });

  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<{ type: 'image' | 'video', data: string, mimeType: string }[]>([]);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history:", e);
    }
  }, [messages]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ thinkingMode }));
  }, [thinkingMode]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || isThinking) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: inputText,
      attachments: [...attachments]
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setAttachments([]);
    setIsThinking(true);

    try {
      const responseText = await aiChatService.sendMessage(
        userMsg.text, 
        userMsg.attachments?.map(a => ({ data: a.data, mimeType: a.mimeType })),
        thinkingMode,
        language // Pass current language code
      );
      
      const botMsg: ChatMessage = {
        role: 'model',
        text: responseText
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "So'rovingizni qayta ishlashda xatolik yuz berdi." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        const type = file.type.startsWith('video') ? 'video' : 'image';
        setAttachments(prev => [...prev, { type, data: base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearChat = () => {
    aiChatService.reset();
    const resetState: ChatMessage[] = [{ role: 'model', text: "Chat tarixi tozalandi. Yangi vazifalar uchun tayyorman." }];
    setMessages(resetState);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-500 ${thinkingMode ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-cyan-600 shadow-[0_0_15px_rgba(6,182,212,0.2)]'}`}>
            {thinkingMode ? <BrainCircuit size={24} className="text-white" /> : <Bot size={24} className="text-white" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Sentinel AI Yordamchi
              {thinkingMode && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider animate-in fade-in">Chuqur Fikrlash</span>}
            </h2>
            <p className="text-xs text-slate-400">Gemini 3 Pro asosida ishlaydi</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={handleClearChat}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Chatni tozalash"
            >
                <Trash2 size={18} />
            </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${thinkingMode ? 'bg-indigo-600' : 'bg-cyan-600'}`}>
                <Bot size={16} className="text-white" />
              </div>
            )}
            
            <div className={`max-w-[80%] space-y-2`}>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-slate-800 text-slate-100 rounded-tr-none' 
                  : 'bg-slate-900/80 border border-slate-800 text-slate-300 rounded-tl-none'
              }`}>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                    {msg.attachments.map((att, i) => (
                      <div key={i} className="relative rounded overflow-hidden border border-slate-700 w-32 h-32 shrink-0 bg-black">
                        {att.type === 'image' ? (
                          <img src={att.data} alt="uploaded" className="w-full h-full object-cover" />
                        ) : (
                          <video src={att.data} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute top-1 right-1 bg-black/50 rounded p-1">
                            {att.type === 'video' ? <Video size={12} className="text-white"/> : <ImageIcon size={12} className="text-white"/>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                <User size={16} className="text-slate-300" />
              </div>
            )}
          </div>
        ))}
        
        {isThinking && (
          <div className="flex gap-4 justify-start animate-pulse">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${thinkingMode ? 'bg-indigo-600' : 'bg-cyan-600'}`}>
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
              {thinkingMode ? (
                  <>
                    <BrainCircuit size={18} className="text-indigo-400 animate-pulse" />
                    <span className="text-sm text-indigo-300 italic">Chuqur mantiqiy tahlil...</span>
                  </>
              ) : (
                  <>
                    <Loader2 size={18} className="text-cyan-400 animate-spin" />
                    <span className="text-sm text-slate-400 italic">Javob yozilmoqda...</span>
                  </>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
            <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                {attachments.map((att, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700 group">
                        {att.type === 'image' ? (
                            <img src={att.data} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-black flex items-center justify-center">
                                <Video size={24} className="text-slate-500" />
                            </div>
                        )}
                        <button 
                            onClick={() => removeAttachment(i)}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 rounded-full p-1 text-white transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-3">
          <div className="flex gap-2">
             <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*,video/*" 
                multiple
                onChange={handleFileUpload}
             />
             <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-cyan-400 transition-colors border border-slate-700"
                title="Rasm yoki Video yuklash"
             >
                <div className="relative">
                    <ImageIcon size={20} />
                    <Video size={14} className="absolute -bottom-1 -right-2 text-slate-500" />
                </div>
             </button>
          </div>

          <div className="flex-1 relative">
            <input 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={thinkingMode ? "Xavfsizlik jurnallari yoki videolari bo'yicha murakkab savol bering..." : "Xabaringizni yozing..."}
                className={`w-full bg-slate-950 border ${thinkingMode ? 'border-indigo-500/30 focus:border-indigo-500' : 'border-slate-800 focus:border-cyan-500'} rounded-xl py-3 pl-4 pr-12 text-slate-200 focus:ring-1 focus:ring-opacity-50 outline-none transition-all`}
            />
          </div>

          <button 
            type="button"
            onClick={() => setThinkingMode(!thinkingMode)}
            className={`p-3 rounded-xl transition-all border group relative ${
                thinkingMode 
                ? 'bg-indigo-900/30 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
            title={thinkingMode ? "Chuqur Fikrlashni O'chirish" : "Chuqur Fikrlashni Yoqish (Reasoning)"}
          >
            <BrainCircuit size={20} className={thinkingMode ? "animate-pulse" : ""} />
            {thinkingMode && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
            )}
          </button>

          <button 
            type="submit"
            disabled={(!inputText.trim() && attachments.length === 0) || isThinking}
            className={`p-3 rounded-xl text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                thinkingMode 
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20' 
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20'
            }`}
          >
            {isThinking ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
        <div className="mt-2 text-center">
            <span className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                <Network size={10} /> 
                {thinkingMode ? 'Gemini 3 Pro (Thinking Mode) bilan himoyalangan' : 'Gemini 3 Pro bilan himoyalangan'}
            </span>
        </div>
      </div>
    </div>
  );
};
