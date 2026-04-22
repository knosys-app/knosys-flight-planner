import type { CSSProperties, FC, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { SheetDetent } from '../sheet/flight-sheet';

function detentCssHeight(d: SheetDetent): string {
  switch (d) {
    case 'peek': return '72px';
    case 'half': return '45vh';
    case 'full': return '90vh';
  }
}

/**
 * Root layout shell: full-bleed map layer + chrome layer for floating UI.
 * v0.3.3 diagnostic: measures its own dimensions on mount + renders a red
 * banner inside the chrome layer so we can tell from looking at the page
 * whether the shell is reaching the DOM and has non-zero size.
 */
export const FlightShell: FC<{
  map: ReactNode;
  sheetDetent: SheetDetent;
  children?: ReactNode;
}> = ({ map, sheetDetent, children }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rectOf = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      if (!r) return 'null';
      return `${Math.round(r.width)}×${Math.round(r.height)} @ ${Math.round(r.x)},${Math.round(r.y)}`;
    };
    const measure = (tag: string) => {
      const r = rootRef.current;
      const m = mapRef.current;
      const c = chromeRef.current;
      const cs = r ? getComputedStyle(r) : null;
      console.log(
        `[flight-planner] dims[${tag}] root=${rectOf(r)} | map=${rectOf(m)} | chrome=${rectOf(c)} | parent=${rectOf(r?.parentElement)} | gp=${rectOf(r?.parentElement?.parentElement)} | ggp=${rectOf(r?.parentElement?.parentElement?.parentElement)} | cssH=${cs?.height} cssW=${cs?.width} pos=${cs?.position} disp=${cs?.display} ovfl=${cs?.overflow}`,
      );
    };
    measure('mount');
    const t = setTimeout(() => measure('200ms'), 200);
    return () => clearTimeout(t);
  }, []);

  const style = {
    ['--kfp-sheet-detent' as any]: detentCssHeight(sheetDetent),
  } as CSSProperties;
  return (
    <div ref={rootRef} className="kfp-root" style={style}>
      <div ref={mapRef} className="kfp-map-layer">{map}</div>
      <div ref={chromeRef} className="kfp-chrome-layer">
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            padding: '10px 16px',
            background: '#c33',
            color: 'white',
            fontFamily: '-apple-system, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            pointerEvents: 'auto',
          }}
        >
          v0.3.3 DIAGNOSTIC BANNER — if you see this red bar, FlightShell rendered into the DOM.
        </div>
        {children}
      </div>
    </div>
  );
};
