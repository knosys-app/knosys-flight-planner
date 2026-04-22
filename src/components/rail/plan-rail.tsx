import type { FC, ReactNode } from 'react';
import type { SharedDependencies } from '../../types';

export interface RailSectionProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}

export function createPlanRail(Shared: SharedDependencies) {
  const { useState, lucideIcons } = Shared;
  const { ChevronDown } = lucideIcons as Record<string, any>;

  const RailSection: FC<RailSectionProps> = ({
    title,
    action,
    children,
    defaultOpen = true,
    collapsible = true,
  }) => {
    const [open, setOpen] = useState(defaultOpen);
    const effectiveOpen = collapsible ? open : true;

    return (
      <section className="kfp-rail-card">
        {title && (
          <div className="kfp-rail-card-header">
            <button
              type="button"
              className="kfp-label-caps"
              onClick={() => collapsible && setOpen(!open)}
              disabled={!collapsible}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: collapsible ? 'pointer' : 'default',
                color: 'inherit',
              }}
            >
              {collapsible && ChevronDown && (
                <ChevronDown
                  className="w-3 h-3"
                  style={{
                    transition: 'transform 180ms var(--kfp-spring-b)',
                    transform: effectiveOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                />
              )}
              {title}
            </button>
            {action}
          </div>
        )}
        {effectiveOpen && <div>{children}</div>}
      </section>
    );
  };

  const PlanRail: FC<{ children: ReactNode }> = ({ children }) => (
    <aside className="kfp-rail kfp-surface-thin" aria-label="Flight plan rail">
      <div className="kfp-rail-scroll kfp-stagger">{children}</div>
    </aside>
  );

  return { PlanRail, RailSection };
}
