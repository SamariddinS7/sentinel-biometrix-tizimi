import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Image as ImageIcon, Video, Bot, User, Trash2, Loader2, Network, 
  Sparkles, X, BrainCircuit, Mic, MapPin, Volume2, Copy, Check, FileText, 
  MessageSquare, Sliders, Globe, RefreshCw, AlertCircle, Play, Square, MapPinned
} from 'lucide-react';
import { 
  aiChatService, ChatMessage, transcribeAudio, getMapsGrounding, 
  analyzeVideo, analyzeImage 
} from '../services/geminiService';
import { useLanguage } from '../services/i18n';

const STORAGE_KEY = 'sentinel_ai_chat_history';
const SETTINGS_KEY = 'sentinel_ai_chat_settings';

export const AIChatView: React.FC = () => {
  const { t, language } = useLanguage();
  
  // Tabs: 'chat' | 'tools'
  const [activeTab, setActiveTab] = useState<'chat' | 'tools'>('chat');
  // Tools Sub-Tabs: 'audio' | 'maps' | 'media'
  const [activeTool, setActiveTool] = useState<'audio' | 'maps' | 'media'>('audio');

  // --- CHAT STATE ---
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "undefined") {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
    return [{ role: 'model', text: "Assalomu alaykum, Administrator. Men Sentinel AI – sizning xavfsizlik bo'yicha yordamchingizman. Men jurnallarni tahlil qilishim, xavfsizlik tasvirlarini ko'rib chiqishim yoki tizim haqidagi savollarga javob berishim mumkin. Bugun sizga qanday yordam bera olaman?" }];
  });

  const [thinkingMode, setThinkingMode] = useState(() => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved && saved !== "undefined") {
            return JSON.parse(saved).thinkingMode;
        }
    } catch { return false; }
    return false;
  });

  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<{ type: 'image' | 'video', data: string, mimeType: string }[]>([]);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- AUDIO TOOL STATE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  const [copiedTranscription, setCopiedTranscription] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // --- MAPS GROUNDING STATE ---
  const [mapsQuery, setMapsQuery] = useState('');
  const [isMapsLoading, setIsMapsLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<{ text: string, groundingChunks: any[] } | null>(null);

  // --- MEDIA ANALYST STATE ---
  const [mediaFile, setMediaFile] = useState<{ type: 'image' | 'video', data: string, mimeType: string } | null>(null);
  const [mediaPrompt, setMediaPrompt] = useState('Ushbu xavfsizlik kamerasidan olingan materialda biron bir qoidabuzarlik yoki shubhali faoliyat bormi?');
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [mediaReport, setMediaReport] = useState<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (activeTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, activeTab]);

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

  // Timer for audio recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

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
        language
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

  // --- AUDIO TRANSCRIBER ACTIONS ---
  const startAudioRecording = async () => {
    try {
      setTranscriptionText('');
      setAudioBase64(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const fullBase64 = reader.result as string;
          const base64Clean = fullBase64.split(',')[1];
          setAudioBase64(fullBase64);
          
          setIsTranscribing(true);
          try {
            const text = await transcribeAudio(base64Clean, 'audio/wav');
            setTranscriptionText(text || "Audio bo'sh yoki hech qanday gap aniqlanmadi.");
          } catch (err: any) {
            console.error("Transcribe failed:", err);
            setTranscriptionText("Audio yozuvni transkripsiya qilish imkonsiz bo'ldi. Mikrofonda muammo yoki shunga o'xshash xatolik.");
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      setTranscriptionText("Mikrofonni ishga tushirishda xatolik yuz berdi. Iltimos, brauzer ruxsatlarini tekshiring.");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCopyTranscription = () => {
    if (!transcriptionText) return;
    navigator.clipboard.writeText(transcriptionText);
    setCopiedTranscription(true);
    setTimeout(() => setCopiedTranscription(false), 2000);
  };

  const sendTranscriptionToChat = () => {
    if (!transcriptionText) return;
    setInputText(transcriptionText);
    setActiveTab('chat');
  };

  // --- MAPS GROUNDING ACTIONS ---
  const handleMapsSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsQuery.trim() || isMapsLoading) return;

    setIsMapsLoading(true);
    try {
      const result = await getMapsGrounding(mapsQuery);
      setMapsResult(result);
    } catch (err) {
      console.error("Maps search error:", err);
      setMapsResult({
        text: "Joylashuv so'rovini amalga oshirishda xatolik yuz berdi.",
        groundingChunks: []
      });
    } finally {
      setIsMapsLoading(false);
    }
  };

  // --- MEDIA ANALYST ACTIONS ---
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setMediaFile({
          type,
          data: base64,
          mimeType: file.type
        });
        setMediaReport(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMediaAnalysis = async () => {
    if (!mediaFile || isMediaLoading) return;

    setIsMediaLoading(true);
    setMediaReport(null);
    const base64Data = mediaFile.data.split(',')[1];

    try {
      let result = '';
      if (mediaFile.type === 'image') {
        result = await analyzeImage(base64Data, mediaFile.mimeType, mediaPrompt);
      } else {
        result = await analyzeVideo(base64Data, mediaFile.mimeType, mediaPrompt);
      }
      setMediaReport(result);
    } catch (err) {
      console.error("Media analysis error:", err);
      setMediaReport("Tahlil jarayonida xatolik yuz berdi. Fayl o'lchami yoki formatini tekshiring.");
    } finally {
      setIsMediaLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-panel rounded-xl border border-border overflow-hidden shadow-lg">
      {/* Dynamic Header */}
      <div className="p-4 border-b border-border bg-app-panel flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-500 bg-brand-primary shadow-[0_0_15px_rgba(6,182,212,0.2)]`}>
            <Bot size={24} className="text-text-inverted animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              Sentinel AI Kognitiv Tizimi
            </h2>
            <p className="text-xs text-text-secondary">Gemini Multi-Model Security Intelligence</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-app-surface p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-brand-primary text-text-inverted shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <MessageSquare size={16} />
            <span>AI Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'tools'
                ? 'bg-brand-primary text-text-inverted shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sliders size={16} />
            <span>AI Asboblar</span>
          </button>
        </div>
      </div>

      {/* CHAT TAB VIEW */}
      {activeTab === 'chat' && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-app-primary/30">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-brand-primary`}>
                    <Bot size={16} className="text-text-inverted" />
                  </div>
                )}
                
                <div className={`max-w-[80%] space-y-2`}>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-app-surface text-text-primary rounded-tr-none border border-border/40' 
                      : 'bg-app-panel border border-border text-text-secondary rounded-tl-none'
                  }`}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="relative rounded overflow-hidden border border-border w-32 h-32 shrink-0 bg-black">
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
                    <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-app-surface border border-border flex items-center justify-center shrink-0 mt-1">
                    <User size={16} className="text-text-secondary" />
                  </div>
                )}
              </div>
            ))}
            
            {isThinking && (
              <div className="flex gap-4 justify-start animate-pulse">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-primary`}>
                  <Bot size={16} className="text-text-inverted" />
                </div>
                <div className="bg-app-panel border border-border p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                    <Loader2 size={18} className="text-brand-primary animate-spin" />
                    <span className="text-sm text-text-muted italic">Javob yozilmoqda...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-app-panel border-t border-border">
            {/* Attachment Previews */}
            {attachments.length > 0 && (
                <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group bg-black">
                            {att.type === 'image' ? (
                                <img src={att.data} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Video size={24} className="text-text-muted" />
                                </div>
                            )}
                            <button 
                                onClick={() => removeAttachment(i)}
                                className="absolute top-1 right-1 bg-black/70 hover:bg-status-critical-text rounded-full p-1 text-white transition-colors cursor-pointer"
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
                    className="p-3 rounded-xl bg-app-surface text-text-secondary hover:bg-app-primary hover:text-brand-primary transition-colors border border-border cursor-pointer"
                    title="Rasm yoki Video yuklash"
                 >
                    <div className="relative">
                        <ImageIcon size={20} />
                        <Video size={14} className="absolute -bottom-1 -right-2 text-text-muted" />
                    </div>
                 </button>
              </div>

              <div className="flex-1 relative">
                <input 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Xavfsizlik jurnallari yoki videolari bo'yicha savol bering..."
                    className="w-full bg-app-primary border border-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl py-3 pl-4 pr-12 text-text-primary outline-none transition-all placeholder:text-text-muted/60"
                />
              </div>

              <button 
                type="button"
                onClick={() => setThinkingMode(!thinkingMode)}
                className={`p-3 rounded-xl transition-all border group relative cursor-pointer ${
                    thinkingMode 
                    ? 'bg-brand-secondary/20 border-brand-secondary text-brand-secondary shadow' 
                    : 'bg-app-surface border-border text-text-secondary hover:text-text-primary hover:border-border-focus'
                }`}
                title={thinkingMode ? "Chuqur Fikrlashni O'chirish" : "Chuqur Fikrlashni Yoqish (Reasoning)"}
              >
                <BrainCircuit size={20} className={thinkingMode ? "animate-pulse" : ""} />
                {thinkingMode && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-secondary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-secondary"></span>
                    </span>
                )}
              </button>

              <button 
                type="submit"
                disabled={(!inputText.trim() && attachments.length === 0) || isThinking}
                className="p-3 rounded-xl text-text-inverted bg-brand-primary hover:bg-brand-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow cursor-pointer"
              >
                {isThinking ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </form>
          </div>
        </>
      )}

      {/* MULTI-MODAL TOOLS TAB VIEW */}
      {activeTab === 'tools' && (
        <div className="flex-1 flex flex-col md:flex-row bg-app-primary/10 overflow-hidden">
          {/* Sidebar selector for Tools */}
          <div className="w-full md:w-64 bg-app-primary/30 border-b md:border-b-0 md:border-r border-border p-4 flex md:flex-col gap-2 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTool('audio')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all shrink-0 md:shrink border cursor-pointer ${
                activeTool === 'audio'
                  ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow'
                  : 'text-text-secondary hover:text-text-primary border-transparent'
              }`}
            >
              <Mic size={18} />
              <span>Ovozli Transkripsiya</span>
            </button>
            
            <button
              onClick={() => setActiveTool('maps')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all shrink-0 md:shrink border cursor-pointer ${
                activeTool === 'maps'
                  ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow'
                  : 'text-text-secondary hover:text-text-primary border-transparent'
              }`}
            >
              <MapPinned size={18} />
              <span>Jonli Xarita Qidiruvi</span>
            </button>

            <button
              onClick={() => setActiveTool('media')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all shrink-0 md:shrink border cursor-pointer ${
                activeTool === 'media'
                  ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow'
                  : 'text-text-secondary hover:text-text-primary border-transparent'
              }`}
            >
              <FileText size={18} />
              <span>Kamera & Video Tahlili</span>
            </button>
          </div>

          {/* Active Tool Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-app-primary/10">
            
            {/* 1. AUDIO TRANSCRIBER */}
            {activeTool === 'audio' && (
              <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
                <div className="bg-app-panel border border-border p-6 rounded-2xl shadow space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <Mic className="text-brand-primary animate-pulse" /> Mikrofon orqali yozib olish
                      </h3>
                      <p className="text-xs text-text-secondary">Nutqingizni yozib oling va Gemini yordamida matnga o'giring.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-xl bg-app-primary/20 relative overflow-hidden">
                    {isRecording && (
                      <div className="absolute inset-0 bg-brand-primary/5 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 rounded-full bg-brand-primary/10 animate-ping absolute" />
                        <div className="w-32 h-32 rounded-full bg-brand-primary/15 animate-pulse absolute" />
                      </div>
                    )}

                    <div className="relative z-10 flex flex-col items-center space-y-4">
                      {isRecording ? (
                        <button
                          onClick={stopAudioRecording}
                          className="w-16 h-16 rounded-full bg-status-critical-text hover:bg-status-critical-text/90 flex items-center justify-center text-white transition-all shadow-md cursor-pointer active:scale-95"
                        >
                          <Square size={24} fill="currentColor" />
                        </button>
                      ) : (
                        <button
                          onClick={startAudioRecording}
                          className="w-16 h-16 rounded-full bg-brand-primary hover:bg-brand-primary/90 flex items-center justify-center text-text-inverted transition-all shadow-md cursor-pointer active:scale-95"
                          disabled={isTranscribing}
                        >
                          <Mic size={24} />
                        </button>
                      )}

                      <span className="text-sm font-bold text-text-secondary">
                        {isRecording ? `Yozilmoqda... ${recordingSeconds}s` : 'Boshlash uchun mikrofon tugmasini bosing'}
                      </span>
                    </div>
                  </div>

                  {isTranscribing && (
                    <div className="flex items-center justify-center gap-3 py-6 text-brand-primary animate-pulse font-semibold">
                      <Loader2 className="animate-spin" />
                      <span className="text-sm">Gemini transkripsiya qilmoqda...</span>
                    </div>
                  )}

                  {transcriptionText && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Matn natijasi:</h4>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCopyTranscription}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-surface hover:bg-app-primary text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors border border-border cursor-pointer"
                          >
                            {copiedTranscription ? <Check size={14} className="text-status-safe-text" /> : <Copy size={14} />}
                            <span>{copiedTranscription ? "Nusxalandi" : "Nusxalash"}</span>
                          </button>

                          <button
                            onClick={sendTranscriptionToChat}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-xs font-semibold text-text-inverted transition-colors cursor-pointer shadow"
                          >
                            <MessageSquare size={14} />
                            <span>Chatga yuborish</span>
                          </button>
                        </div>
                      </div>
                      <div className="bg-app-primary/40 border border-border rounded-xl p-4 text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                        {transcriptionText}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. MAPS GROUNDING */}
            {activeTool === 'maps' && (
              <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
                <div className="bg-app-panel border border-border p-6 rounded-2xl shadow space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                      <MapPin className="text-brand-primary" /> Jonli Geo-Intellektual Qidiruv
                    </h3>
                    <p className="text-xs text-text-secondary">Google Maps ma'lumotlari bilan bog'langan real vaqtda joylashuv tahlili.</p>
                  </div>

                  <form onSubmit={handleMapsSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={mapsQuery}
                      onChange={(e) => setMapsQuery(e.target.value)}
                      placeholder="Masalan: Eng yaqin Sentinel nazorat nuqtasi qayerda? yoki Toshkentdagi xavfsizlik zonalari..."
                      className="flex-1 bg-app-primary border border-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 py-3 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted/60"
                    />
                    <button
                      type="submit"
                      disabled={isMapsLoading || !mapsQuery.trim()}
                      className="px-5 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-text-inverted font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow"
                    >
                      {isMapsLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      <span>Qidirish</span>
                    </button>
                  </form>

                  {isMapsLoading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-brand-primary">
                      <Loader2 size={32} className="animate-spin" />
                      <span className="text-sm font-semibold italic">Google Maps orqali tekshirilmoqda...</span>
                    </div>
                  )}

                  {mapsResult && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="bg-app-primary/30 p-5 rounded-xl border border-border text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                        {mapsResult.text}
                      </div>

                      {mapsResult.groundingChunks && mapsResult.groundingChunks.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Globe size={14} className="text-brand-primary" /> Manbalar & Xarita Ma'lumotlari:
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {mapsResult.groundingChunks.map((chunk: any, i: number) => {
                              const mapsUrl = chunk.web?.uri || chunk.maps?.uri;
                              const title = chunk.web?.title || chunk.maps?.title || "Xarita nuqtasi";
                              return (
                                <div key={i} className="flex items-center justify-between p-3 bg-app-panel rounded-lg border border-border text-xs">
                                  <span className="text-text-primary font-bold">{title}</span>
                                  {mapsUrl && (
                                    <a
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-brand-primary hover:underline flex items-center gap-1 font-semibold"
                                    >
                                      Xaritada ko'rish <MapPin size={12} />
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. MEDIA INTELLIGENCE */}
            {activeTool === 'media' && (
              <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
                <div className="bg-app-panel border border-border p-6 rounded-2xl shadow space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                      <ImageIcon className="text-brand-primary" /> CCTV rasm va video tahlili
                    </h3>
                    <p className="text-xs text-text-secondary">Kamera va videoyozuvlarni anomaliyalar va xavfsizlik holatlarini aniqlash uchun tahlil qiling.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Image Upload Box */}
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border hover:border-brand-primary bg-app-primary/20 hover:bg-app-primary/40 rounded-xl cursor-pointer transition-all text-center">
                      <ImageIcon className="text-text-muted mb-2" size={24} />
                      <span className="text-xs text-text-secondary font-semibold">Rasm yuklash (JPEG, PNG)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleMediaUpload(e, 'image')}
                      />
                    </label>

                    {/* Video Upload Box */}
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border hover:border-brand-primary bg-app-primary/20 hover:bg-app-primary/40 rounded-xl cursor-pointer transition-all text-center">
                      <Video className="text-text-muted mb-2" size={24} />
                      <span className="text-xs text-text-secondary font-semibold">Video yuklash (MP4)</span>
                      <input
                        type="file"
                        accept="video/mp4"
                        className="hidden"
                        onChange={(e) => handleMediaUpload(e, 'video')}
                      />
                    </label>
                  </div>

                  {mediaFile && (
                    <div className="p-4 bg-app-primary rounded-xl border border-border space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                          {mediaFile.type === 'image' ? <ImageIcon size={14} className="text-brand-primary" /> : <Video size={14} className="text-brand-primary" />}
                          Yuklangan material ({mediaFile.type === 'image' ? 'Rasm' : 'Video'})
                        </span>
                        <button
                          onClick={() => { setMediaFile(null); setMediaReport(null); }}
                          className="text-text-muted hover:text-text-primary cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="relative aspect-video max-h-60 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-border">
                        {mediaFile.type === 'image' ? (
                          <img src={mediaFile.data} alt="Upload preview" className="w-full h-full object-contain" />
                        ) : (
                          <video src={mediaFile.data} controls className="w-full h-full object-contain" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tahlil yo'riqnomasi (Prompt):</label>
                        <textarea
                          rows={3}
                          value={mediaPrompt}
                          onChange={(e) => setMediaPrompt(e.target.value)}
                          className="w-full bg-app-panel border border-border focus:border-brand-primary rounded-xl p-3 text-sm text-text-primary outline-none transition-all"
                        />
                      </div>

                      <button
                        onClick={handleMediaAnalysis}
                        disabled={isMediaLoading}
                        className="w-full py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-text-inverted font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow"
                      >
                        {isMediaLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        <span>{isMediaLoading ? 'Material tahlil qilinmoqda...' : 'Intellektual tahlilni boshlash'}</span>
                      </button>
                    </div>
                  )}

                  {mediaReport && (
                    <div className="bg-app-primary/30 p-5 rounded-xl border border-border text-text-secondary text-sm leading-relaxed whitespace-pre-wrap animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 text-brand-primary font-bold mb-3">
                        <FileText size={18} />
                        <span>Xavfsizlik Tahlili Hisoboti:</span>
                      </div>
                      {mediaReport}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default AIChatView;
