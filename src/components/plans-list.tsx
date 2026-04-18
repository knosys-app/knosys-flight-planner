import type { FC } from 'react';
import type { Plan, SharedDependencies } from '../types';

export function createPlansList(Shared: SharedDependencies) {
  const { Button, dateFns, lucideIcons } = Shared;
  const { FileText } = lucideIcons as Record<string, any>;

  const PlansList: FC<{
    plans: Plan[];
    currentId: string | null;
    onOpen: (id: string) => void;
  }> = ({ plans, currentId, onOpen }) => {
    if (plans.length === 0) {
      return (
        <div className="text-xs text-muted-foreground px-2 py-1">
          No saved plans yet. Build a route and hit Save.
        </div>
      );
    }
    return (
      <div className="space-y-1">
        {plans.map((p) => {
          const updated = (() => {
            try {
              return dateFns.format(dateFns.parseISO(p.updatedAt), 'MMM d, p');
            } catch {
              return p.updatedAt;
            }
          })();
          return (
            <Button
              key={p.id}
              variant={p.id === currentId ? 'secondary' : 'ghost'}
              className="w-full justify-start h-auto py-2"
              onClick={() => onOpen(p.id)}
            >
              {FileText && <FileText className="w-4 h-4 mr-2 shrink-0" />}
              <div className="flex-1 min-w-0 text-left">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.departureIcao || '?'} → {p.destinationIcao || '?'} · {updated}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    );
  };

  return PlansList;
}
