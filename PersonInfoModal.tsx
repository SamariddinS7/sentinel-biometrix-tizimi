
import React from 'react';
import { X, User as UserIcon, ShieldCheck, Activity, Clock, MapPin, Fingerprint } from 'lucide-react';
import { UserRole } from '../types';

export interface PersonDetails {
    id: string;
    name: string;
    role: string;
    department?: string;
    avatarUrl?: string;
    confidence?: number;
    lastSeen?: string;
    location?: string;
    status?: string;
}

interface PersonInfoModalProps {
    person: PersonDetails | null;
    onClose: () => void;
    onViewIntelligence?: (personId: string) => void;
}

export const PersonInfoModal: React.FC<PersonInfoModalProps> = ({ person, onClose, onViewIntelligence }) => {
    if (!person) return null;

    const isUnknown = person.name === 'UNKNOWN' || person.status === 'UNKNOWN';
    const roleColor = person.role === UserRole.ADMIN ? 'text-purple-400' : 
                      person.role === UserRole.OPERATOR ? 'text-blue-400' : 'text-text-secondary';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="bg-app-panel border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Background */}
                <div className={`h-24 w-full ${isUnknown ? 'bg-red-900/30' : 'bg-gradient-to-r from-cyan-900/30 to-blue-900/30'} absolute top-0 left-0`}></div>
                
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-text-secondary hover:text-white z-10 p-1 bg-black/20 rounded-full hover:bg-black/50 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="pt-12 px-6 pb-6 relative z-0 flex flex-col items-center">
                    {/* Avatar */}
                    <div className="relative mb-4">
                        <div className={`w-24 h-24 rounded-full p-1 border-4 ${isUnknown ? 'border-red-500 bg-red-950' : 'border-cyan-500 bg-app-panel'}`}>
                            {person.avatarUrl ? (
                                <img src={person.avatarUrl} alt={person.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <div className="w-full h-full rounded-full flex items-center justify-center text-text-primary0">
                                    <UserIcon size={40} />
                                </div>
                            )}
                        </div>
                        {person.confidence && (
                            <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-full text-xs font-bold border shadow-lg ${person.confidence > 0.8 ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-amber-500 border-amber-400 text-black'}`}>
                                {(person.confidence * 100).toFixed(0)}%
                            </div>
                        )}
                    </div>

                    {/* Name & Role */}
                    <h2 className="text-2xl font-bold text-white text-center mb-1">{person.name}</h2>
                    <div className="flex items-center gap-2 mb-6">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded border bg-app-surface border-border ${roleColor}`}>
                            {person.role}
                        </span>
                        {person.department && (
                            <span className="text-xs text-text-secondary border-l border-border pl-2">
                                {person.department}
                            </span>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="w-full grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-app-primary p-3 rounded-xl border border-border flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-app-panel text-cyan-400">
                                <Fingerprint size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-text-primary0 uppercase font-bold">ID</p>
                                <p className="text-sm font-mono text-text-primary truncate max-w-[100px]">{person.id}</p>
                            </div>
                        </div>
                        <div className="bg-app-primary p-3 rounded-xl border border-border flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-app-panel text-emerald-400">
                                <Activity size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-text-primary0 uppercase font-bold">Status</p>
                                <p className="text-sm font-medium text-text-primary">{person.status || 'Active'}</p>
                            </div>
                        </div>
                        <div className="bg-app-primary p-3 rounded-xl border border-border flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-app-panel text-indigo-400">
                                <Clock size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-text-primary0 uppercase font-bold">Last Seen</p>
                                <p className="text-sm font-medium text-text-primary">{person.lastSeen || 'Just now'}</p>
                            </div>
                        </div>
                        <div className="bg-app-primary p-3 rounded-xl border border-border flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-app-panel text-rose-400">
                                <MapPin size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-text-primary0 uppercase font-bold">Location</p>
                                <p className="text-sm font-medium text-text-primary">{person.location || 'Unknown'}</p>
                            </div>
                        </div>
                    </div>

                     {/* Footer Actions */}
                    <div className="w-full flex gap-3">
                        <button 
                            onClick={() => onViewIntelligence && onViewIntelligence(person.id)}
                            className="flex-1 py-2.5 rounded-lg bg-app-surface hover:bg-app-surface text-text-secondary text-sm font-bold transition-colors"
                        >
                            View History
                        </button>
                        <button 
                            onClick={() => onViewIntelligence && onViewIntelligence(person.id)}
                            className="flex-1 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-colors shadow-lg shadow-cyan-900/20"
                        >
                            View Profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
