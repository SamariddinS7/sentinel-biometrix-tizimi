
import React, { useState } from 'react';
import { HelpCircle, X, Phone, Mail, ExternalLink, FileText, Send, CheckCircle2, Server, LifeBuoy, MessageSquare, AlertCircle } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketData, setTicketData] = useState({ subject: '', message: '' });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setTicketSent(true);
      setTimeout(() => {
          setTicketSent(false);
          setTicketData({ subject: '', message: '' });
          onClose();
      }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
       <div className="bg-app-panel border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
          
          <div className="p-4 sm:p-6 border-b border-border flex justify-between items-center bg-app-primary">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                    <LifeBuoy size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white truncate">Yordam Markazi</h2>
                    <p className="text-[10px] sm:text-xs text-text-primary0">Sentinel Biometrics Enterprise Support</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 text-text-secondary hover:text-white transition-colors shrink-0"><X size={20} className="sm:w-6 sm:h-6"/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 custom-scrollbar">
             
             {/* Left Column: Resources */}
             <div className="space-y-6">
                <div>
                    <h3 className="text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Tezkor Bog'lanish</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-4 p-4 bg-app-primary border border-border rounded-xl">
                             <div className="w-10 h-10 rounded-full bg-app-panel flex items-center justify-center text-cyan-400 shrink-0">
                                <Phone size={20} />
                             </div>
                             <div className="min-w-0">
                                <p className="text-[10px] text-text-primary0 font-bold uppercase tracking-wider">Ishonch telefoni (24/7)</p>
                                <p className="text-base sm:text-lg font-mono text-white truncate">+998 (71) 200-00-00</p>
                             </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-app-primary border border-border rounded-xl">
                             <div className="w-10 h-10 rounded-full bg-app-panel flex items-center justify-center text-cyan-400 shrink-0">
                                <Mail size={20} />
                             </div>
                             <div className="min-w-0">
                                <p className="text-[10px] text-text-primary0 font-bold uppercase tracking-wider">Texnik qo'llab-quvvatlash</p>
                                <p className="text-sm text-white truncate">support@sentinel.uz</p>
                             </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Hujjatlar</h3>
                    <div className="space-y-2">
                        <a href="#" className="flex items-center justify-between p-3 bg-app-surface hover:bg-app-surface rounded-lg transition-colors group">
                            <span className="text-xs sm:text-sm text-text-primary flex items-center gap-2 truncate"><FileText size={16} className="shrink-0"/> Admin Qo'llanma (PDF)</span>
                            <ExternalLink size={14} className="text-text-primary0 group-hover:text-white shrink-0" />
                        </a>
                        <a href="#" className="flex items-center justify-between p-3 bg-app-surface hover:bg-app-surface rounded-lg transition-colors group">
                            <span className="text-xs sm:text-sm text-text-primary flex items-center gap-2 truncate"><Server size={16} className="shrink-0"/> API Ma'lumotnomasi v3.0</span>
                            <ExternalLink size={14} className="text-text-primary0 group-hover:text-white shrink-0" />
                        </a>
                    </div>
                </div>
             </div>

             {/* Right Column: Ticket Form */}
             <div className="bg-app-primary border border-border rounded-xl p-4 sm:p-6">
                {!ticketSent ? (
                    <form onSubmit={handleSubmit} className="space-y-4 h-full flex flex-col">
                        <div>
                            <h3 className="text-white font-bold mb-1 flex items-center gap-2"><MessageSquare size={18} className="text-cyan-400"/> Murojaat Qoldirish</h3>
                            <p className="text-[10px] sm:text-xs text-text-primary0">Muhandislarimiz 2 soat ichida javob berishadi.</p>
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-text-primary0 uppercase mb-1 tracking-wider">Mavzu</label>
                            <select 
                                required
                                value={ticketData.subject} 
                                onChange={e => setTicketData({...ticketData, subject: e.target.value})}
                                className="w-full bg-app-panel border border-border rounded-lg p-2.5 text-sm text-text-primary focus:border-cyan-500 outline-none transition-colors appearance-none"
                            >
                                <option value="" disabled>Turini tanlang...</option>
                                <option value="Access">Kirish muammosi</option>
                                <option value="Hardware">Kamera / Uskuna xatosi</option>
                                <option value="Bug">Tizim xatoligi (Bug)</option>
                                <option value="Feature">Yangi taklif</option>
                            </select>
                        </div>
                        
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-text-primary0 uppercase mb-1 tracking-wider">Xabar</label>
                            <textarea 
                                required
                                value={ticketData.message} 
                                onChange={e => setTicketData({...ticketData, message: e.target.value})}
                                className="w-full min-h-[120px] bg-app-panel border border-border rounded-lg p-3 text-sm text-text-primary focus:border-cyan-500 outline-none resize-none transition-colors"
                                placeholder="Muammoni batafsil tasvirlab bering..."
                            ></textarea>
                        </div>

                        <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-900/20 active:scale-95">
                            <Send size={18} /> Yuborish
                        </button>
                    </form>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8 space-y-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                            <CheckCircle2 size={40} className="animate-in zoom-in spin-in-180 duration-500" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-white">Murojaat yuborildi!</h3>
                            <p className="text-text-secondary text-xs sm:text-sm mt-1">ID: TKT-{Math.floor(Math.random()*10000)}</p>
                            <p className="text-text-primary0 text-[10px] sm:text-xs mt-4">Javob bo'lganda sizga xabar beriladi.</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
          
          <div className="p-3 bg-app-primary border-t border-border flex justify-between text-[9px] sm:text-[10px] text-text-primary0 px-4 sm:px-6">
             <span>System Build: 2024.01.29-ENT</span>
             <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Tizim barqaror</span>
          </div>
       </div>
    </div>
  );
};
