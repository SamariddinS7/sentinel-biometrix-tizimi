import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Mail, KeyRound, ArrowRight, Fingerprint, Eye, EyeOff,
  User as UserIcon, Building2, CheckCircle2, AlertCircle, UserPlus, LogIn,
} from 'lucide-react';
import { authService } from '../services/authService';

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';

interface Props {
  onLogin: () => void;
}

// ── Animated background dots ──────────────────────────────────────────────────

const GridDots: React.FC = () => (
  <svg
    className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

// ── Input field wrapper ───────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{icon}</span>
      {children}
    </div>
  </div>
);

const inputCls =
  'w-full bg-app-primary border border-border text-text-primary text-sm rounded-lg pl-10 pr-4 py-3 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all placeholder:text-text-muted';

// ── Left panel animated background ───────────────────────────────────────────

const ORBS = [
  { w: 320, h: 320, top: '55%', left: '60%', delay: 0,    dur: 7  },
  { w: 180, h: 180, top: '15%', left: '75%', delay: 1.5,  dur: 9  },
  { w: 120, h: 120, top: '72%', left: '20%', delay: 3,    dur: 11 },
  { w: 90,  h: 90,  top: '30%', left: '5%',  delay: 2,    dur: 8  },
];

const RINGS = [0, 1, 2, 3];

const PanelBackground: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
    {/* Soft floating orbs */}
    {ORBS.map((o, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: o.w,
          height: o.h,
          top: o.top,
          left: o.left,
          translateX: '-50%',
          translateY: '-50%',
          background: 'radial-gradient(circle, rgba(0,153,255,0.08) 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: o.dur, delay: o.delay, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}

    {/* Radar pulse rings — centred lower-right */}
    <div className="absolute" style={{ bottom: '12%', right: '8%' }}>
      {RINGS.map((r) => (
        <motion.div
          key={r}
          className="absolute rounded-full border border-brand-primary/25"
          style={{ inset: 0, width: 48, height: 48 }}
          animate={{ scale: [1, 5 + r * 2], opacity: [0.6, 0] }}
          transition={{
            duration: 3.2,
            delay: r * 0.8,
            repeat: Infinity,
            ease: [0.2, 0.8, 0.4, 1],
          }}
        />
      ))}
      {/* Solid core dot */}
      <motion.div
        className="w-12 h-12 rounded-full bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-2 h-2 rounded-full bg-brand-primary/70" />
      </motion.div>
    </div>

    {/* Horizontal scan line */}
    <motion.div
      className="absolute left-0 right-0 h-px"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(0,153,255,0.18), transparent)' }}
      animate={{ top: ['20%', '85%', '20%'] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* Small floating dots */}
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 rounded-full bg-brand-primary/40"
        style={{ top: `${15 + i * 13}%`, left: `${10 + (i % 3) * 30}%` }}
        animate={{
          y: [0, -18, 0],
          opacity: [0.3, 0.8, 0.3],
        }}
        transition={{
          duration: 4 + i * 0.7,
          delay: i * 0.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

// ── Feature list (left panel) ─────────────────────────────────────────────────

const FEATURES = [
  { icon: '🎯', text: "Yuz tanish va ReID biometrikasi" },
  { icon: '📡', text: "Real vaqtda kamera monitoring" },
  { icon: '🛡️', text: "GDPR muvofiq ma'lumot himoyasi" },
  { icon: '🤖', text: "YOLOv8n va ONNX asosidagi AI" },
  { icon: '📊', text: "Enterprise tahlil va hisobotlar" },
];

// ── Main component ────────────────────────────────────────────────────────────

export const AuthPage: React.FC<Props> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDept, setRegDept] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // ── Login ─────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError("Email va parolni kiriting.");
      return;
    }
    setLoginLoading(true);
    try {
      await authService.login(loginEmail, loginPassword);
      onLogin();
    } catch (err: any) {
      setLoginError(err.message ?? "Kirish amalga oshmadi. Ma'lumotlarni tekshiring.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleBootstrapLogin = async () => {
    const bootstrapPassword = prompt(
      "Bootstrap admin kirish.\nServerda o'rnatilgan BOOTSTRAP_ADMIN_PASSWORD ni kiriting:"
    );
    if (!bootstrapPassword) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      await authService.login('admin@sentinel.sys', bootstrapPassword);
      onLogin();
    } catch {
      setLoginError("Bootstrap kirish amalga oshmadi. Serverni tekshiring.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────────────────────

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regFullName.trim() || regFullName.trim().length < 3) {
      setRegError("To'liq ism kamida 3 harfdan iborat bo'lishi kerak.");
      return;
    }
    if (!regEmail.includes('@')) {
      setRegError("Yaroqli email manzil kiriting.");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("Parol kamida 6 belgidan iborat bo'lishi kerak.");
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError("Parollar mos kelmadi.");
      return;
    }

    setRegLoading(true);
    try {
      await authService.register(regFullName.trim(), regEmail.trim(), regPassword, regDept.trim());
      setRegSuccess(true);
      // Auto-login after registration
      setTimeout(() => onLogin(), 1200);
    } catch (err: any) {
      setRegError(err.message ?? "Ro'yxatdan o'tish amalga oshmadi.");
    } finally {
      setRegLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-app-primary flex overflow-hidden relative">
      <GridDots />

      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_50%,_var(--tw-gradient-stops))] from-brand-primary/10 via-transparent to-transparent pointer-events-none" />

      {/* ── Left branding panel (hidden on small screens) ─────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] xl:w-[40%] border-r border-border relative p-12">
        <PanelBackground />
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/30">
            <Shield size={22} className="text-white" fill="currentColor" />
          </div>
          <div>
            <div className="font-bold text-text-primary leading-tight">Sentinel Biometrics</div>
            <div className="text-[11px] text-text-muted">Enterprise Security Platform</div>
          </div>
        </div>

        {/* Hero text */}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl xl:text-5xl font-black text-text-primary leading-tight mb-4"
          >
            Xavfsizlik
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">
              intellekti
            </span>
            <br />
            yangi darajada.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary text-sm leading-relaxed max-w-sm"
          >
            Real vaqtda biometrik monitoring, yuz tanish va kross-kamera harakatini kuzatish — barchasi bitta platformada.
          </motion.p>

          {/* Features */}
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 space-y-3"
          >
            {FEATURES.map((f, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.07 }}
                className="flex items-center gap-3 text-sm text-text-secondary"
              >
                <span className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center text-base flex-shrink-0">
                  {f.icon}
                </span>
                {f.text}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-text-muted">v3.0.4-Enterprise · © 2026 Sentinel Systems</p>
      </div>

      {/* ── Right auth panel ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
            <Shield size={20} className="text-white" fill="currentColor" />
          </div>
          <span className="font-bold text-text-primary">Sentinel Biometrics</span>
        </div>

        <div className="w-full max-w-[420px]">

          {/* Mode switcher */}
          <div className="flex bg-app-panel border border-border rounded-xl p-1 mb-8">
            {(['login', 'register'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setLoginError(''); setRegError(''); setRegSuccess(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m
                    ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/30'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {m === 'login'
                  ? <><LogIn size={14} /> Kirish</>
                  : <><UserPlus size={14} /> Ro'yxatdan o'tish</>}
              </button>
            ))}
          </div>

          {/* Animated form area */}
          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <h2 className="text-2xl font-bold text-text-primary mb-1">Xush kelibsiz</h2>
                <p className="text-sm text-text-muted mb-6">Hisobingizga kiring</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="Email manzil" icon={<Mail size={15} />}>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      className={inputCls}
                      placeholder="ism@kompaniya.com"
                      autoComplete="email"
                    />
                  </Field>

                  <Field label="Parol" icon={<KeyRound size={15} />}>
                    <input
                      type={showLoginPass ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className={`${inputCls} pr-10`}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    >
                      {showLoginPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </Field>

                  {/* Error */}
                  <AnimatePresence>
                    {loginError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                      >
                        <AlertCircle size={14} className="flex-shrink-0" />
                        {loginError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 rounded-lg shadow-lg shadow-brand-primary/25 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                  >
                    {loginLoading
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><LogIn size={16} /> Kirish</>}
                  </button>
                </form>

                <div className="flex items-center gap-3 my-5">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-wider text-text-muted">yoki</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <button
                  type="button"
                  onClick={handleBootstrapLogin}
                  disabled={loginLoading}
                  className="w-full bg-app-surface hover:bg-app-primary border border-border text-text-primary font-semibold py-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <Fingerprint size={16} className="text-brand-primary" />
                  Admin tizimga kirish (Bootstrap)
                </button>

                <p className="text-center text-xs text-text-muted mt-6">
                  Hisob yo'qmi?{' '}
                  <button
                    onClick={() => setMode('register')}
                    className="text-brand-primary hover:underline font-medium"
                  >
                    Ro'yxatdan o'ting
                  </button>
                </p>
              </motion.div>

            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <h2 className="text-2xl font-bold text-text-primary mb-1">Hisob yaratish</h2>
                <p className="text-sm text-text-muted mb-6">Platforma orqali xavfsizlikni boshqaring</p>

                {regSuccess ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center py-10 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                      <CheckCircle2 size={32} className="text-green-400" />
                    </div>
                    <h3 className="font-bold text-text-primary text-lg mb-1">Muvaffaqiyatli!</h3>
                    <p className="text-sm text-text-muted">Hisobingiz yaratildi. Tizimga kirilmoqda…</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <Field label="To'liq ism" icon={<UserIcon size={15} />}>
                      <input
                        type="text"
                        value={regFullName}
                        onChange={e => setRegFullName(e.target.value)}
                        className={inputCls}
                        placeholder="Alisher Qodirov"
                        autoComplete="name"
                      />
                    </Field>

                    <Field label="Email manzil" icon={<Mail size={15} />}>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        className={inputCls}
                        placeholder="ism@kompaniya.com"
                        autoComplete="email"
                      />
                    </Field>

                    <Field label="Bo'lim (ixtiyoriy)" icon={<Building2 size={15} />}>
                      <input
                        type="text"
                        value={regDept}
                        onChange={e => setRegDept(e.target.value)}
                        className={inputCls}
                        placeholder="IT Bo'limi, Xavfsizlik…"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Parol" icon={<KeyRound size={15} />}>
                        <input
                          type={showRegPass ? 'text' : 'password'}
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          className={`${inputCls} pr-10`}
                          placeholder="min 6 belgi"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                        >
                          {showRegPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </Field>

                      <Field label="Tasdiqlash" icon={<KeyRound size={15} />}>
                        <input
                          type="password"
                          value={regConfirm}
                          onChange={e => setRegConfirm(e.target.value)}
                          className={inputCls}
                          placeholder="••••••"
                          autoComplete="new-password"
                        />
                      </Field>
                    </div>

                    {/* Password strength */}
                    {regPassword.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(lvl => {
                            const strength =
                              regPassword.length >= 12 ? 4 :
                              regPassword.length >= 8 ? 3 :
                              regPassword.length >= 6 ? 2 : 1;
                            return (
                              <div
                                key={lvl}
                                className={`h-1 flex-1 rounded-full transition-all ${
                                  lvl <= strength
                                    ? strength >= 4 ? 'bg-green-500' : strength >= 3 ? 'bg-teal-500' : strength >= 2 ? 'bg-amber-500' : 'bg-red-500'
                                    : 'bg-border'
                                }`}
                              />
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-text-muted">
                          {regPassword.length >= 12 ? 'Juda kuchli parol ✓' :
                           regPassword.length >= 8 ? 'Kuchli parol' :
                           regPassword.length >= 6 ? 'O\'rtacha parol' : 'Zaif parol'}
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    <AnimatePresence>
                      {regError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                        >
                          <AlertCircle size={14} className="flex-shrink-0" />
                          {regError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 rounded-lg shadow-lg shadow-brand-primary/25 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {regLoading
                        ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><UserPlus size={16} /> Hisob yaratish</>}
                    </button>
                  </form>
                )}

                <p className="text-center text-xs text-text-muted mt-6">
                  Hisobingiz bormi?{' '}
                  <button
                    onClick={() => setMode('login')}
                    className="text-brand-primary hover:underline font-medium"
                  >
                    Kiring
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="absolute bottom-4 text-[11px] text-text-muted">
          v3.0.4-Enterprise · Sentinel Biometrik Tizimi
        </p>
      </div>
    </div>
  );
};
