'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '@/components/ui/Icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Shows a tasteful install chip when the browser offers PWA installation. */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 surface-strong rounded-full pl-4 pr-2 py-2 flex items-center gap-3 shadow-float"
        >
          <span className="text-aurora-cyan"><Icon name="download" size={16} /></span>
          <span className="text-sm text-titanium-100">Install Pulse for instant access</span>
          <button
            onClick={install}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-aurora-cyan to-aurora-violet text-on-accent text-xs font-semibold"
          >
            Install
          </button>
          <button onClick={() => setVisible(false)} className="text-titanium-400 px-2 text-lg leading-none">×</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
