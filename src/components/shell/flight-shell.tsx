import type { CSSProperties, FC, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * Root layout shell: full-bleed map + chrome overlay.
 *
 * The Knosys host's flex tree uses `min-height` (not `height`) on the
 * SidebarProvider, so CSS `height: 100%` can't resolve down the chain
 * and `.kfp-root` collapses to 0. We sidestep that by measuring
 * `window.innerHeight - rect.top` at mount and pinning our root height
 * inline. Re-measure on viewport resize.
 */
export const FlightShell: FC<{
  map: ReactNode;
  children?: ReactNode;
}> = ({ map, children }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [fittedHeight, setFittedHeight] = useState<number | null>(null);

  useEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setFittedHeight(Math.max(200, window.innerHeight - top));
    };
    fit();
    const t = setTimeout(fit, 50);
    window.addEventListener('resize', fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', fit);
    };
  }, []);

  const style: CSSProperties = {
    height: fittedHeight != null ? `${fittedHeight}px` : '100%',
  };

  return (
    <div ref={rootRef} className="kfp-root" style={style}>
      <div className="kfp-map-layer">{map}</div>
      <div className="kfp-chrome-layer">{children}</div>
    </div>
  );
};
