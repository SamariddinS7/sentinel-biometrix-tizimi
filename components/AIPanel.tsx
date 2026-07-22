/**
 * AIPanel — Right-side drawer that renders the unified AICopilot.
 * All tabs (Copilot / AI Chat / Asboblar) live inside AICopilot itself.
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AICopilot } from './AICopilot';

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentView?: string;
  onNavigate?: (view: string) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ isOpen, onClose, currentView, onNavigate }) => {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — mobile only */}
          <motion.div
            key="ai-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="ai-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[430px] bg-[#0d1117] border-l border-white/10 z-50 flex flex-col shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-2.5 right-3 z-10 p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
              title="Yopish (Esc)"
            >
              <X size={16} />
            </button>

            {/* AICopilot fills the panel */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AICopilot
                currentView={currentView}
                onNavigate={(v) => {
                  onNavigate?.(v);
                  onClose();
                }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
