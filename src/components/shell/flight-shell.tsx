import type { CSSProperties, FC, ReactNode } from 'react';
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
 * Applies the `.kfp-root` scope so every design token and material class
 * resolves. Keeps the map in its own stacking context so translucent
 * overlays composite cleanly. Publishes the current sheet detent as a
 * CSS custom property so the rail can size itself to leave room.
 */
export const FlightShell: FC<{
  map: ReactNode;
  sheetDetent: SheetDetent;
  children?: ReactNode;
}> = ({ map, sheetDetent, children }) => {
  const style = {
    ['--kfp-sheet-detent' as any]: detentCssHeight(sheetDetent),
  } as CSSProperties;
  return (
    <div className="kfp-root" style={style}>
      <div className="kfp-map-layer">{map}</div>
      <div className="kfp-chrome-layer">{children}</div>
    </div>
  );
};
