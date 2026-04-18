import type { FC } from 'react';
import type { Plan, SharedDependencies } from '../types';
import { listPlans } from '../store/plan-store';

export function createDashboardWidgets(Shared: SharedDependencies) {
  const { useState, useEffect, useNavigate, dateFns, lucideIcons } = Shared;
  const { Plane, Clock } = lucideIcons as Record<string, any>;

  const RecentPlansWidget: FC = () => {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<Plan[]>([]);
    useEffect(() => {
      void listPlans().then((p) => setPlans(p.slice(0, 3)));
    }, []);
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2">
          {Plane && <Plane className="w-4 h-4" />} Recent flight plans
        </div>
        {plans.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No saved plans yet. Open Flight Planner to create one.
          </div>
        ) : (
          <div className="space-y-1">
            {plans.map((p) => (
              <button
                key={p.id}
                className="w-full text-left text-xs hover:bg-accent rounded px-2 py-1"
                onClick={() => navigate?.('/flight-planner')}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-muted-foreground">
                  {p.departureIcao} → {p.destinationIcao}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const NextFlightWidget: FC = () => {
    const [nextPlan, setNextPlan] = useState<Plan | null>(null);
    useEffect(() => {
      (async () => {
        const plans = await listPlans();
        const upcoming = plans
          .filter((p) => p.departureTimeUtc)
          .sort((a, b) => (a.departureTimeUtc ?? '').localeCompare(b.departureTimeUtc ?? ''))
          .find((p) => p.departureTimeUtc && new Date(p.departureTimeUtc) >= new Date());
        setNextPlan(upcoming ?? plans[0] ?? null);
      })();
    }, []);

    return (
      <div className="p-3">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2">
          {Clock && <Clock className="w-4 h-4" />} Next flight
        </div>
        {nextPlan ? (
          <div className="text-xs">
            <div className="font-medium">{nextPlan.name}</div>
            <div className="text-muted-foreground">
              {nextPlan.departureIcao} → {nextPlan.destinationIcao}
            </div>
            {nextPlan.departureTimeUtc && (
              <div className="text-muted-foreground">
                {dateFns.format(dateFns.parseISO(nextPlan.departureTimeUtc), 'PPp')}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No flight scheduled.</div>
        )}
      </div>
    );
  };

  return { RecentPlansWidget, NextFlightWidget };
}
