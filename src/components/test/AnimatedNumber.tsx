'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedNumber — smoothly interpolates toward a target value using a spring
 * so live metrics glide instead of jumping. Uses tabular figures.
 */

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  className?: string;
}

export default function AnimatedNumber({ value, decimals = 1, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number>(0);
  const currentRef = useRef(value);
  const targetRef = useRef(value);

  useEffect(() => {
    targetRef.current = value;
  }, [value]);

  useEffect(() => {
    const tick = () => {
      const diff = targetRef.current - currentRef.current;
      if (Math.abs(diff) < 0.01) {
        currentRef.current = targetRef.current;
      } else {
        currentRef.current += diff * 0.18;
      }
      setDisplay(currentRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <span className={`tabular ${className ?? ''}`}>{display.toFixed(decimals)}</span>;
}
