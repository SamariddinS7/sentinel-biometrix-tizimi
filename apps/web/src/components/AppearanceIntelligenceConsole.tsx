import React, { useState, useEffect } from 'react';
import { 
  Search, Shield, Layers, HelpCircle, Sparkles, Filter, Check, Play, 
  Sliders, Info, Eye, Activity, Database, CheckCircle2, AlertTriangle, 
  RefreshCw, User, Cpu, AlertCircle, Bookmark, Shirt, Trash2, Gauge, Scale
} from 'lucide-react';
import { appearanceIntelligenceEngine, AppearanceProfile, SearchQuery } from '../services/ai/AppearanceIntelligenceEngine';
import { motion, AnimatePresence } from 'motion/react';

export const AppearanceIntelligenceConsole: React.FC = () => {
  const [profiles, setProfiles] = useState<AppearanceProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Hard attribute filters
  const [upperColor, setUpperColor] = useState('ALL');
  const [lowerColor, setLowerColor] = useState('ALL');
  const [hasBackpack, setHasBackpack] = useState<boolean | null>(null);
  const [hasHelmet, setHasHelmet] = useState<boolean | null>(null);
  const [hasVest, setHasVest] = useState<boolean | null>(null);
  const [hasUmbrella, setHasUmbrella] = useState<boolean | null>(null);
  const [hasSuitcase, setHasSuitcase] = useState<boolean | null>(null);
  const [bodySize, setBodySize] = useState('ALL');

  // Search results
  const [results, setResults] = useState<Array<{ profile: AppearanceProfile; score: number }>>([]);

  // QA and Diagnostic Tests state
  const [diagnosticActive, setDiagnosticActive] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<Array<{ testName: string; status: 'SUCCESS' | 'FAILURE'; log: string }>>([]);

  const loadProfiles = () => {
    // Perform search combining textual natural search and selected filters
    const query: SearchQuery = {
      naturalText: searchTerm || undefined,
      upperColor: upperColor !== 'ALL' ? upperColor : undefined,
      lowerColor: lowerColor !== 'ALL' ? lowerColor : undefined,
      backpack: hasBackpack !== null ? hasBackpack : undefined,
      helmet: hasHelmet !== null ? hasHelmet : undefined,
      vest: hasVest !== null ? hasVest : undefined,
      umbrella: hasUmbrella !== null ? hasUmbrella : undefined,
      suitcase: hasSuitcase !== null ? hasSuitcase : undefined,
      bodySize: bodySize !== 'ALL' ? bodySize : undefined,
    };

    const hits = appearanceIntelligenceEngine.searchByAttributes(query);
    setResults(hits);

    // Get all raw profiles for metrics
    const all = appearanceIntelligenceEngine.getAllProfiles();
    setProfiles(all);

    // Default select
    if (hits.length > 0 && !selectedId) {
      setSelectedId(hits[0].profile.id);
    }
  };

  useEffect(() => {
    loadProfiles();
    const interval = setInterval(loadProfiles, 3000);
    return () => clearInterval(interval);
  }, [searchTerm, upperColor, lowerColor, hasBackpack, hasHelmet, hasVest, hasUmbrella, hasSuitcase, bodySize]);

  const selectedProfile = profiles.find(p => p.id === selectedId);

  // Compute aggregated stats
  const totalProfiles = profiles.length;
  const helmetCount = profiles.filter(p => p.helmet).length;
  const vestCount = profiles.filter(p => p.vest).length;
  const backpackCount = profiles.filter(p => p.backpack).length;

  const runQualityDiagnostics = async () => {
    setDiagnosticActive(true);
    setDiagnosticLogs([]);
    const logs = appearanceIntelligenceEngine.runDiagnosticTests();
    setDiagnosticLogs(logs);
    setDiagnosticActive(false);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setUpperColor('ALL');
    setLowerColor('ALL');
    setHasBackpack(null);
    setHasHelmet(null);
    setHasVest(null);
    setHasUmbrella(null);
    setHasSuitcase(null);
    setBodySize('ALL');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Overview Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
            <Shirt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Tashqi ko'rinish profillari</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{totalProfiles}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-status-safe-bg text-status-safe-text rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Kaska kiyganlar (Helmet)</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{helmetCount}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-status-safe-bg/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Nimcha kiyganlar (Vest)</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{vestCount}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Ryukzaklilar (Backpack)</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{backpackCount}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Panel: Query & Filter Suite */}
        <div className="xl:col-span-4 bg-app-panel border border-border rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Filter size={18} className="text-brand-primary" /> Atributlar Qidiruv Filtri
            </h3>
            <button 
              onClick={clearAllFilters}
              className="text-xs font-bold text-text-muted hover:text-brand-primary flex items-center gap-1 transition-colors"
            >
              <Trash2 size={12} /> Tozalash
            </button>
          </div>

          {/* Text/Natural Query */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Matnli / Tabiiy Til Qidiruvi</label>
            <div className="relative">
              <Search className="w-4.5 h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Masalan: 'red jacket with backpack'..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-app-primary border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Hard Filters */}
          <div className="space-y-4 pt-2 border-t border-border/50">
            
            {/* Clothing Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Ustki kiyim rangi</label>
                <select
                  value={upperColor}
                  onChange={(e) => setUpperColor(e.target.value)}
                  className="w-full bg-app-primary border border-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                >
                  <option value="ALL">Barchasi</option>
                  <option value="Dark Charcoal">To'q kulrang</option>
                  <option value="Navy Blue">To'q ko'k</option>
                  <option value="Crimson Red">Qizil</option>
                  <option value="Pure White">Oq</option>
                  <option value="Forest Green">Yashil</option>
                  <option value="Bright Yellow">Sariq</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Pastki kiyim rangi</label>
                <select
                  value={lowerColor}
                  onChange={(e) => setLowerColor(e.target.value)}
                  className="w-full bg-app-primary border border-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-primary"
                >
                  <option value="ALL">Barchasi</option>
                  <option value="Blue Jeans">Ko'k jinsi</option>
                  <option value="Black Pants">Qora shim</option>
                  <option value="Gray Shorts">Kulrang shortik</option>
                  <option value="Beige Khakis">Bej shim</option>
                  <option value="Navy Pants">To'q ko'k shim</option>
                </select>
              </div>
            </div>

            {/* Body Size */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Tana o'lchami (Estimated Body Size)</label>
              <select
                value={bodySize}
                onChange={(e) => setBodySize(e.target.value)}
                className="w-full bg-app-primary border border-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-primary"
              >
                <option value="ALL">Barcha o'lchamlar</option>
                <option value="Tall">Baland bo'yli (Tall)</option>
                <option value="Standard">O'rtacha bo'yli (Standard)</option>
                <option value="Short">Past bo'yli (Short)</option>
              </select>
            </div>

            {/* Binary Switch Filters */}
            <div className="space-y-2.5 pt-2">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Maxsus kiyim va aksessuarlar</label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setHasBackpack(hasBackpack === null ? true : hasBackpack === true ? false : null)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all
                    ${hasBackpack === true ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold' : 
                      hasBackpack === false ? 'bg-status-critical-bg border-status-critical-text/30 text-status-critical-text' : 
                      'bg-app-primary border-border text-text-secondary'}`}
                >
                  <span>Ryukzak</span>
                  <span className="text-[9px] font-mono opacity-60">
                    {hasBackpack === true ? 'BOR' : hasBackpack === false ? 'YO\'Q' : 'HAMMASI'}
                  </span>
                </button>

                <button
                  onClick={() => setHasHelmet(hasHelmet === null ? true : hasHelmet === true ? false : null)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all
                    ${hasHelmet === true ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold' : 
                      hasHelmet === false ? 'bg-status-critical-bg border-status-critical-text/30 text-status-critical-text' : 
                      'bg-app-primary border-border text-text-secondary'}`}
                >
                  <span>Kaska</span>
                  <span className="text-[9px] font-mono opacity-60">
                    {hasHelmet === true ? 'BOR' : hasHelmet === false ? 'YO\'Q' : 'HAMMASI'}
                  </span>
                </button>

                <button
                  onClick={() => setHasVest(hasVest === null ? true : hasVest === true ? false : null)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all
                    ${hasVest === true ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold' : 
                      hasVest === false ? 'bg-status-critical-bg border-status-critical-text/30 text-status-critical-text' : 
                      'bg-app-primary border-border text-text-secondary'}`}
                >
                  <span>Nimcha (Vest)</span>
                  <span className="text-[9px] font-mono opacity-60">
                    {hasVest === true ? 'BOR' : hasVest === false ? 'YO\'Q' : 'HAMMASI'}
                  </span>
                </button>

                <button
                  onClick={() => setHasUmbrella(hasUmbrella === null ? true : hasUmbrella === true ? false : null)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all
                    ${hasUmbrella === true ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold' : 
                      hasUmbrella === false ? 'bg-status-critical-bg border-status-critical-text/30 text-status-critical-text' : 
                      'bg-app-primary border-border text-text-secondary'}`}
                >
                  <span>Soyabon</span>
                  <span className="text-[9px] font-mono opacity-60">
                    {hasUmbrella === true ? 'BOR' : hasUmbrella === false ? 'YO\'Q' : 'HAMMASI'}
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Center Panel: Result Gallery */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Eye size={18} className="text-brand-primary animate-pulse" /> Atribut moslik natijalari ({results.length})
              </h3>
              <span className="text-[10px] bg-app-primary border border-border px-2.5 py-1 rounded-lg text-text-muted font-mono">
                GPU TENSOR_RT INFERENCE ENABLED
              </span>
            </div>

            {results.length === 0 ? (
              <div className="p-16 text-center text-text-muted space-y-3">
                <AlertCircle size={32} className="mx-auto text-text-muted/40" />
                <p className="font-medium text-sm">Ushbu atributlarga mos keladigan shaxs topilmadi.</p>
                <button onClick={clearAllFilters} className="text-xs text-brand-primary font-bold underline">Filtrlarni tozalash</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map(({ profile, score }) => {
                  const isSelected = profile.id === selectedId;
                  return (
                    <div
                      key={profile.id}
                      onClick={() => setSelectedId(profile.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden group
                        ${isSelected ? 'bg-app-surface border-brand-primary/80 ring-1 ring-brand-primary/20' : 'bg-app-primary border-border hover:border-brand-primary/40'}`}
                    >
                      {/* Percent Match Badge */}
                      <div className="absolute top-3 right-3 bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold text-[10px] border border-brand-primary/20">
                        {(score * 100).toFixed(0)}% mos
                      </div>

                      <div>
                        <span className="font-mono text-[10px] text-text-muted font-bold tracking-widest block uppercase">{profile.id}</span>
                        <h4 className="font-bold text-text-primary text-sm mt-0.5">{profile.id.startsWith('F-') ? `Shaxs ${profile.id}` : profile.id}</h4>
                      </div>

                      {/* Visual representations */}
                      <div className="flex gap-4 items-center">
                        {/* Upper Color Box */}
                        <div className="text-center space-y-1">
                          <span className="text-[8px] text-text-muted font-bold uppercase block">Ustki</span>
                          <div 
                            className="w-12 h-6 rounded border border-border/80 shadow-inner"
                            style={{ backgroundColor: `rgb(${profile.dominantColor.rgb.r}, ${profile.dominantColor.rgb.g}, ${profile.dominantColor.rgb.b})` }}
                            title={`RGB: ${profile.dominantColor.rgb.r}, ${profile.dominantColor.rgb.g}, ${profile.dominantColor.rgb.b}`}
                          />
                        </div>

                        {/* Lower Color Box */}
                        <div className="text-center space-y-1">
                          <span className="text-[8px] text-text-muted font-bold uppercase block">Pastki</span>
                          <div 
                            className="w-12 h-6 rounded border border-border/80 shadow-inner"
                            style={{ backgroundColor: `rgb(${profile.secondaryColor.rgb.r}, ${profile.secondaryColor.rgb.g}, ${profile.secondaryColor.rgb.b})` }}
                            title={`RGB: ${profile.secondaryColor.rgb.r}, ${profile.secondaryColor.rgb.g}, ${profile.secondaryColor.rgb.b}`}
                          />
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-1 text-[11px] text-text-muted">
                          <div><span className="font-bold text-text-secondary">Ustki:</span> {profile.upperClothingType}</div>
                          <div><span className="font-bold text-text-secondary">Pastki:</span> {profile.lowerClothingType}</div>
                          <div><span className="font-bold text-text-secondary">O'lcham:</span> {profile.estimatedBodySize}</div>
                          <div><span className="font-bold text-text-secondary">Poyabzal:</span> {profile.shoes}</div>
                        </div>
                      </div>

                      {/* Accessory Indicator icons row */}
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
                        {profile.helmet && <span className="bg-status-safe-bg/10 text-status-safe-text text-[9px] font-bold px-1.5 py-0.5 rounded border border-status-safe-text/15">Kaska</span>}
                        {profile.vest && <span className="bg-yellow-500/10 text-yellow-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/15">Nimcha</span>}
                        {profile.backpack && <span className="bg-purple-500/10 text-purple-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-purple-500/15">Ryukzak</span>}
                        {profile.umbrella && <span className="bg-blue-500/10 text-blue-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-500/15">Soyabon</span>}
                        {profile.suitcase && <span className="bg-orange-500/10 text-orange-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-orange-500/15">Suitcase</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deep Selected Profile Workspace and QA diagnostics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* selected profile details */}
            <div className="bg-app-panel border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                <User size={16} className="text-brand-primary" /> Batafsil Atributlar va Spektr Tahlili
              </h3>

              {selectedProfile ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-app-primary border border-border rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[9px] text-text-muted font-bold block">TIZIM REFERENSI</span>
                      <span className="font-bold text-text-primary text-sm">{selectedProfile.id}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-text-muted font-bold block">KUZATUVLAR SONI</span>
                      <span className="font-mono font-bold text-brand-primary">{selectedProfile.observationsCount} marta</span>
                    </div>
                  </div>

                  {/* Spectral Color detail representation */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Spektral Rang Tahlili</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-app-primary border border-border rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-text-secondary">Dominant</span>
                          <div 
                            className="w-5 h-5 rounded border border-border shadow-sm"
                            style={{ backgroundColor: `rgb(${selectedProfile.dominantColor.rgb.r}, ${selectedProfile.dominantColor.rgb.g}, ${selectedProfile.dominantColor.rgb.b})` }}
                          />
                        </div>
                        <div className="font-mono text-[9px] text-text-muted space-y-0.5">
                          <div>RGB: {selectedProfile.dominantColor.rgb.r}, {selectedProfile.dominantColor.rgb.g}, {selectedProfile.dominantColor.rgb.b}</div>
                          <div>HSV: {selectedProfile.dominantColor.hsv.h}°, {selectedProfile.dominantColor.hsv.s}%, {selectedProfile.dominantColor.hsv.v}%</div>
                          <div>LAB: L:{selectedProfile.dominantColor.lab.l}, a:{selectedProfile.dominantColor.lab.a}, b:{selectedProfile.dominantColor.lab.b}</div>
                        </div>
                      </div>

                      <div className="p-3 bg-app-primary border border-border rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-text-secondary">Secondary</span>
                          <div 
                            className="w-5 h-5 rounded border border-border shadow-sm"
                            style={{ backgroundColor: `rgb(${selectedProfile.secondaryColor.rgb.r}, ${selectedProfile.secondaryColor.rgb.g}, ${selectedProfile.secondaryColor.rgb.b})` }}
                          />
                        </div>
                        <div className="font-mono text-[9px] text-text-muted space-y-0.5">
                          <div>RGB: {selectedProfile.secondaryColor.rgb.r}, {selectedProfile.secondaryColor.rgb.g}, {selectedProfile.secondaryColor.rgb.b}</div>
                          <div>HSV: {selectedProfile.secondaryColor.hsv.h}°, {selectedProfile.secondaryColor.hsv.s}%, {selectedProfile.secondaryColor.hsv.v}%</div>
                          <div>LAB: L:{selectedProfile.secondaryColor.lab.l}, a:{selectedProfile.secondaryColor.lab.a}, b:{selectedProfile.secondaryColor.lab.b}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Biological detail */}
                  <div className="bg-app-primary border border-border p-3.5 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Biologik va Konstruktsiya Atributlari</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary">
                      <div><span className="font-bold">Bo'yi (Est):</span> {selectedProfile.estimatedHeightCm} cm</div>
                      <div><span className="font-bold">Soch rangi:</span> {selectedProfile.hairColor}</div>
                      <div><span className="font-bold">Soch uslubi:</span> {selectedProfile.hairStyle}</div>
                      <div><span className="font-bold">Soqol:</span> {selectedProfile.beard ? 'Mavjud' : 'Yo\'q'}</div>
                      <div><span className="font-bold">Kiyim naqshi:</span> {selectedProfile.upperClothingPattern}</div>
                      <div><span className="font-bold">Tana shakli:</span> {selectedProfile.bodyShape}</div>
                    </div>
                    {selectedProfile.carriedObjects.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <span className="font-bold text-text-muted text-[10px]">KO'TARIB YURGAN BUYUMLARI:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedProfile.carriedObjects.map((obj, i) => (
                            <span key={i} className="bg-brand-primary/10 text-brand-primary text-[10px] px-2 py-0.5 rounded font-medium border border-brand-primary/20">{obj}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-text-muted text-xs">Profil tanlanmagan</div>
              )}
            </div>

            {/* QA Test Runner panel */}
            <div className="bg-app-panel border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                  <Cpu size={16} className="text-brand-primary" /> Sinov va QA Diagnostika Stendi
                </h3>
                <button
                  onClick={runQualityDiagnostics}
                  disabled={diagnosticActive}
                  className="bg-brand-primary hover:bg-brand-secondary text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Play size={10} /> Testni Ishga Tushirish
                </button>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                Ushbu stend RGB rang spektrining LAB/HSV tana tahliliga transformatsiyasi, 26 ta atributning to'liqligi va qidiruv indeksini real simulyatsiyadan o'tkazadi.
              </p>

              {diagnosticLogs.length > 0 ? (
                <div className="space-y-2">
                  {diagnosticLogs.map((log, i) => (
                    <div key={i} className="bg-app-primary border border-border p-3 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-text-primary">{log.testName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border
                          ${log.status === 'SUCCESS' ? 'bg-status-safe-bg text-status-safe-text border-status-safe-text/15' : 
                            'bg-status-critical-bg text-status-critical-text border-status-critical-text/15'}`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted font-mono leading-relaxed">{log.log}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-app-primary border border-border border-dashed rounded-xl text-center text-text-muted text-xs">
                  Hech qanday diagnostika testi o'tkazilmagan.
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
