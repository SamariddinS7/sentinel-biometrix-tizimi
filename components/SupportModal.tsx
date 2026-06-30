
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
       <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <LifeBuoy size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Help & Support Center</h2>
                    <p className="text-xs text-slate-500">Sentinel Biometrics Enterprise Support</p>
                </div>
             </div>
             <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
             
             {/* Left Column: Resources */}
             <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Immediate Assistance</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                             <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-cyan-400 shrink-0">
                                <Phone size={20} />
                             </div>
                             <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Emergency Hotline (24/7)</p>
                                <p className="text-lg font-mono text-white">+1 (800) 555-0199</p>
                             </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                             <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-cyan-400 shrink-0">
                                <Mail size={20} />
                             </div>
                             <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Technical Support</p>
                                <p className="text-sm text-white">support@sentinel.sys</p>
                             </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Documentation</h3>
                    <div className="space-y-2">
                        <a href="#" className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group">
                            <span className="text-sm text-slate-200 flex items-center gap-2"><FileText size={16}/> Admin User Guide (PDF)</span>
                            <ExternalLink size={14} className="text-slate-500 group-hover:text-white" />
                        </a>
                        <a href="#" className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group">
                            <span className="text-sm text-slate-200 flex items-center gap-2"><Server size={16}/> API Reference v3.0</span>
                            <ExternalLink size={14} className="text-slate-500 group-hover:text-white" />
                        </a>
                    </div>
                </div>
             </div>

             {/* Right Column: Ticket Form */}
             <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
                {!ticketSent ? (
                    <form onSubmit={handleSubmit} className="space-y-4 h-full flex flex-col">
                        <div>
                            <h3 className="text-white font-bold mb-1 flex items-center gap-2"><MessageSquare size={18} className="text-cyan-400"/> Open Support Ticket</h3>
                            <p className="text-xs text-slate-500">Our engineering team usually responds within 2 hours.</p>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                            <select 
                                required
                                value={ticketData.subject} 
                                onChange={e => setTicketData({...ticketData, subject: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:border-cyan-500 outline-none transition-colors"
                            >
                                <option value="" disabled>Select Issue Type...</option>
                                <option value="Access">Login / Access Issue</option>
                                <option value="Hardware">Camera / Hardware Fault</option>
                                <option value="Bug">Software Bug Report</option>
                                <option value="Feature">Feature Request</option>
                            </select>
                        </div>
                        
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Message</label>
                            <textarea 
                                required
                                value={ticketData.message} 
                                onChange={e => setTicketData({...ticketData, message: e.target.value})}
                                className="w-full h-32 bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:border-cyan-500 outline-none resize-none transition-colors"
                                placeholder="Describe the issue in detail..."
                            ></textarea>
                        </div>

                        <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-900/20">
                            <Send size={18} /> Submit Ticket
                        </button>
                    </form>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                            <CheckCircle2 size={48} className="animate-in zoom-in spin-in-180 duration-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Ticket Submitted!</h3>
                            <p className="text-slate-400 text-sm mt-1">Reference ID: TKT-{Math.floor(Math.random()*10000)}</p>
                            <p className="text-slate-500 text-xs mt-4">We'll notify you via email when there's an update.</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
          
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between text-[10px] text-slate-500 px-6">
             <span>System Build: 2024.01.29-ENT</span>
             <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> All Systems Operational</span>
          </div>
       </div>
    </div>
  );
};
