import { gsap } from 'gsap';
import { useEffect, useRef, useState } from 'react';

/**
 * Utilidades de motion (GSAP) — micro-animaciones sutiles para el CRM.
 * Todo respeta `prefers-reduced-motion` y es seguro bajo React StrictMode
 * (gsap.context + cleanup).
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface EntranceOptions {
  /** Desplazamiento vertical inicial en px (por defecto 10). */
  y?: number;
  /** Duración por elemento en segundos (por defecto 0.4). */
  duration?: number;
  /** Retraso entre elementos en segundos (por defecto 0.04). */
  stagger?: number;
}

/**
 * Anima los hijos directos del elemento referenciado (fade + rise escalonado).
 * Devuelve un ref para acoplar al contenedor.
 */
export function useEntrance<T extends HTMLElement>(deps: unknown[] = [], opts: EntranceOptions = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const el = ref.current;
    if (!el) return;

    const targets = el.children.length > 0 ? Array.from(el.children) : [el];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: opts.y ?? 10 },
        {
          opacity: 1,
          y: 0,
          duration: opts.duration ?? 0.4,
          stagger: opts.stagger ?? 0.04,
          ease: 'power2.out',
          overwrite: 'auto',
        }
      );
    }, el);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

interface CountUpOptions {
  duration?: number;
  delay?: number;
}

/**
 * Anima un número de 0 (o del valor previo) al objetivo, devolviendo el valor
 * actualizado en cada frame. Respeta reduced-motion (salta directo al target).
 */
export function useCountUp(target: number, opts: CountUpOptions = {}): number {
  const { duration = 0.8, delay = 0 } = opts;
  const [val, setVal] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(target);
      current.current = target;
      return;
    }

    const obj = { v: current.current };
    const tween = gsap.to(obj, {
      v: target,
      duration,
      delay,
      ease: 'power1.out',
      onUpdate: () => setVal(obj.v),
      onComplete: () => {
        current.current = target;
      },
    });

    return () => {
      tween.kill();
    };
  }, [target, duration, delay]);

  return Math.round(val);
}
