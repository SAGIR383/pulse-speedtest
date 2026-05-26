'use client';

import { motion } from 'framer-motion';
import Icon from '@/components/ui/Icon';

export default function Recommendations({ items }: { items: string[] }) {
  return (
    <div className="surface rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-aurora-violet">
          <Icon name="zap" size={18} />
        </span>
        <h3 className="font-display text-base tracking-wide text-titanium-100">Smart recommendations</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="flex gap-3 text-sm text-titanium-300 leading-relaxed"
          >
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-aurora-cyan shrink-0 shadow-[0_0_8px_rgba(94,231,224,0.6)]" />
            <span>{item}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
