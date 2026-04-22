import type { CSSProperties, FC, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { SheetDetent } from '../sheet/flight-sheet';

function detentCssHeight(d: SheetDetent): string {
  switch (d) {
    case 'peek': return '72px';
    case 'half': return '45vh';
    case 'full': return '90vh';
  }
}

/**
 * Root layout shell: full-bleed map + chrome overlay.
 *
 * The v0.3.0 regression was that this shell renders both children with
 * `position: absolute; inset: 0`, so `.kfp-root` has zero intrinsic
 * height. In the Knosys host flex tree, `height: 100%` does NOT resolve
 * through every ancestor (SidebarProvider uses min-height, not height),
 * so `.kfp-root` computed to 0×0 and the whole plugin was invisible.
 *
 * Fix: measure the viewport at mount and pin the root's height to
 * `window.innerHeight - getBoundingClientRect().top`. That's the real
 * available space below where we mount, regardless of how the host
 * cascade behaves. Re-measure on resize.
 */
export const FlightShell: FC<{
  map: ReactNode;
  sheetDetent: SheetDetent;
  children?: ReactNode;
}> = ({ map, sheetDetent, children }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [fittedHeight, setFittedHeight] = useState<number | null>(null);

  useEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const h = Math.max(200, window.innerHeight - top);
      setFittedHeight(h);
    };
    fit();
    // Re-measure shortly after mount (layout may settle) and on viewport resize.
    const t = setTimeout(fit, 50);
    window.addEventListener('resize', fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', fit);
    };
  }, []);

  const style: CSSProperties = {
    ['--kfp-sheet-detent' as any]: detentCssHeight(sheetDetent),
    height: fittedHeight != null ? `${fittedHeight}px` : '100%',
  };

  return (
    <div ref={rootRef} className="kfp-root" style={style}>
      <div className="kfp-map-layer">{map}</div>
      <div className="kfp-chrome-layer">{children}</div>
    </div>
  );
};
