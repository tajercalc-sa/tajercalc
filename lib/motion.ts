"use client";

import { useEffect, useRef, useState } from "react";

/** true when the visitor asked the OS for less motion */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Animates a number from its previous value to the new one (ease-out, ~350ms). Instant under reduced motion. */
export function useTweened(target: number, duration = 350) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced || !Number.isFinite(target)) { from.current = target; setShown(target); return; }
    const start = performance.now();
    const a = from.current;
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const v = a + (target - a) * e;
      from.current = v;
      setShown(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, reduced]);
  return shown;
}

/** Returns a key that changes whenever `value` changes (not on first render): use it to replay a pulse class. */
export function usePulseKey(value: unknown) {
  const [key, setKey] = useState(0);
  const first = useRef(true);
  const prev = useRef(value);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (prev.current !== value) { prev.current = value; setKey((k) => k + 1); }
  }, [value]);
  return key;
}
