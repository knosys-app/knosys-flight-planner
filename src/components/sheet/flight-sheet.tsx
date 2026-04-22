import type { FC, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { SharedDependencies } from '../../types';

export type SheetDetent = 'peek' | 'half' | 'full';
export type SheetTab = 'block' | 'navlog' | 'profile' | 'wb';

export interface FlightSheetProps {
  detent: SheetDetent;
  onDetentChange: (d: SheetDetent) => void;
  tab: SheetTab;
  onTabChange: (t: SheetTab) => void;
  block: ReactNode;
  navlog: ReactNode;
  profile: ReactNode;
  wb: ReactNode;
}

const CYCLE: SheetDetent[] = ['peek', 'half', 'full'];

/** Pixel height for a detent given current viewport. */
function detentPx(d: SheetDetent): number {
  switch (d) {
    case 'peek':
      return 28;
    case 'half':
      return Math.round(window.innerHeight * 0.45);
    case 'full':
      return Math.round(window.innerHeight * 0.9);
  }
}

/** Snap a free-dragged pixel height to the nearest detent. */
function snap(px: number): SheetDetent {
  const peek = detentPx('peek');
  const half = detentPx('half');
  const full = detentPx('full');
  const dPeek = Math.abs(px - peek);
  const dHalf = Math.abs(px - half);
  const dFull = Math.abs(px - full);
  const min = Math.min(dPeek, dHalf, dFull);
  if (min === dPeek) return 'peek';
  if (min === dFull) return 'full';
  return 'half';
}

function nextDetent(d: SheetDetent, dir: 1 | -1): SheetDetent {
  const i = CYCLE.indexOf(d);
  const n = Math.max(0, Math.min(CYCLE.length - 1, i + dir));
  return CYCLE[n];
}

interface DragState {
  startY: number;
  startHeight: number;
  currentHeight: number;
}

const TAP_THRESHOLD = 6;

export function createFlightSheet(_Shared: SharedDependencies) {
  const FlightSheet: FC<FlightSheetProps> = ({
    detent,
    onDetentChange,
    tab,
    onTabChange,
    block,
    navlog,
    profile,
    wb,
  }) => {
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const [dragHeight, setDragHeight] = useState<number | null>(null);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!(e.metaKey || e.ctrlKey)) return;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onDetentChange(nextDetent(detent, 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          onDetentChange(nextDetent(detent, -1));
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [detent, onDetentChange]);

    const cycleUp = () => {
      const idx = CYCLE.indexOf(detent);
      onDetentChange(CYCLE[(idx + 1) % CYCLE.length]);
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const startHeight = sheet.getBoundingClientRect().height;
      dragRef.current = {
        startY: e.clientY,
        startHeight,
        currentHeight: startHeight,
      };
      setDragging(true);
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = dragRef.current;
      if (!st) return;
      // Up-drag shrinks distance to top → grows sheet height.
      const delta = st.startY - e.clientY;
      const min = detentPx('peek');
      const max = Math.round(window.innerHeight * 0.95);
      const next = Math.max(min, Math.min(max, st.startHeight + delta));
      st.currentHeight = next;
      setDragHeight(next);
    };

    const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = dragRef.current;
      if (!st) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer may have already been released */
      }
      const moved = Math.abs(st.startY - e.clientY);
      dragRef.current = null;
      setDragging(false);
      setDragHeight(null);
      if (moved < TAP_THRESHOLD) {
        cycleUp();
      } else {
        onDetentChange(snap(st.currentHeight));
      }
    };

    const tabs: Array<{ id: SheetTab; label: string }> = [
      { id: 'block', label: 'Block' },
      { id: 'navlog', label: 'Navlog' },
      { id: 'profile', label: 'Profile' },
      { id: 'wb', label: 'W&B' },
    ];

    const sheetStyle =
      dragHeight != null ? { height: `${dragHeight}px` } : undefined;

    const bodyVisible = detent !== 'peek' || (dragHeight ?? 0) > 80;

    return (
      <div
        ref={sheetRef}
        className="kfp-sheet kfp-surface-thick"
        data-detent={detent}
        data-dragging={dragging ? 'true' : 'false'}
        style={sheetStyle}
      >
        <div
          className="kfp-sheet-handle"
          role="button"
          tabIndex={0}
          aria-label={`Sheet detent ${detent}. Drag or click to resize.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              cycleUp();
            }
          }}
        />
        {bodyVisible && (
          <>
            <div className="kfp-sheet-tabs" role="tablist" aria-label="Sheet tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className="kfp-sheet-tab"
                  data-active={tab === t.id ? 'true' : 'false'}
                  onClick={() => onTabChange(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="kfp-sheet-body">
              {tab === 'block' && block}
              {tab === 'navlog' && navlog}
              {tab === 'profile' && profile}
              {tab === 'wb' && wb}
            </div>
          </>
        )}
      </div>
    );
  };

  return FlightSheet;
}
