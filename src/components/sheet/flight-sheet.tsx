import type { FC, ReactNode } from 'react';
import type { SharedDependencies } from '../../types';

export type SheetDetent = 'peek' | 'half' | 'full';
export type SheetTab = 'block' | 'navlog' | 'profile';

export interface FlightSheetProps {
  detent: SheetDetent;
  onDetentChange: (d: SheetDetent) => void;
  tab: SheetTab;
  onTabChange: (t: SheetTab) => void;
  block: ReactNode;
  navlog: ReactNode;
  profile: ReactNode;
}

const CYCLE: SheetDetent[] = ['peek', 'half', 'full'];

function nextDetent(d: SheetDetent, dir: 1 | -1): SheetDetent {
  const i = CYCLE.indexOf(d);
  const n = Math.max(0, Math.min(CYCLE.length - 1, i + dir));
  return CYCLE[n];
}

export function createFlightSheet(Shared: SharedDependencies) {
  const { useEffect } = Shared;

  const FlightSheet: FC<FlightSheetProps> = ({
    detent,
    onDetentChange,
    tab,
    onTabChange,
    block,
    navlog,
    profile,
  }) => {
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

    const tabs: Array<{ id: SheetTab; label: string }> = [
      { id: 'block', label: 'Block' },
      { id: 'navlog', label: 'Navlog' },
      { id: 'profile', label: 'Profile' },
    ];

    return (
      <div className="kfp-sheet kfp-surface-thick" data-detent={detent}>
        <div
          className="kfp-sheet-handle"
          role="button"
          tabIndex={0}
          aria-label={`Sheet detent ${detent}. Click to cycle.`}
          onClick={cycleUp}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              cycleUp();
            }
          }}
        />
        {detent !== 'peek' && (
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
            </div>
          </>
        )}
      </div>
    );
  };

  return FlightSheet;
}
