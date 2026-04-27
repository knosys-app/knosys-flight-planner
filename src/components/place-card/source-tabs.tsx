import type { FC } from 'react';
import type { SharedDependencies } from '../../types';
import type { AeroSourceId } from '../../data/multi-source-aero-data';
import { getMultiSourceAeroData } from '../../data/multi-source-aero-data';

export type SourceTabState = 'active' | 'available' | 'no-data' | 'unconfigured';

export interface SourceTabsProps {
  active: AeroSourceId;
  /**
   * Per-source per-airport state. The hosting component computes this
   * after attempting each source's findAirportByIcao and decides whether
   * to grey ("no-data") or disable ("unconfigured") tabs that aren't
   * the active selection.
   */
  states: Record<AeroSourceId, SourceTabState>;
  onSelect: (id: AeroSourceId) => void;
}

/**
 * Place-card tab strip across the top of the card body. Tabs share the
 * same order as `MultiSourceAeroData.orderedIds()`. State semantics:
 *
 *   active        — bright, selected tab.
 *   available     — clickable, source has data for this airport.
 *   no-data       — visible but greyed; clicking shows an empty state.
 *   unconfigured  — disabled; tooltip explains the missing config.
 */
export function createSourceTabs(_Shared: SharedDependencies) {
  const facade = getMultiSourceAeroData();
  const ids = facade.orderedIds();

  const SourceTabs: FC<SourceTabsProps> = ({ active, states, onSelect }) => {
    return (
      <div className="kfp-source-tabs" role="tablist" aria-label="Data source">
        {ids.map((id) => {
          const meta = facade.getMeta(id);
          const state = states[id] ?? (meta.configured ? 'available' : 'unconfigured');
          const isActive = id === active;
          const disabled = state === 'unconfigured';
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              data-state={state}
              data-active={isActive ? 'true' : 'false'}
              className="kfp-source-tab"
              onClick={() => !disabled && onSelect(id)}
              title={
                state === 'unconfigured'
                  ? `${meta.label} — not configured. See Settings → Flight Planner.`
                  : state === 'no-data'
                    ? `${meta.label} has no record of this airport.`
                    : meta.label
              }
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    );
  };

  return SourceTabs;
}
