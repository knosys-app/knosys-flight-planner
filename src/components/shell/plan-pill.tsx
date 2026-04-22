import type { FC } from 'react';
import type { Plan, SharedDependencies } from '../../types';

export interface PlanPillProps {
  plan: Plan;
  onRename: (name: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSave: () => void;
}

export function createPlanPill(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    Input,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    lucideIcons,
  } = Shared;
  const { MoreHorizontal, Save, FilePlus, Copy, Trash2 } = lucideIcons as Record<string, any>;

  const PlanPill: FC<PlanPillProps> = ({
    plan,
    onRename,
    onNew,
    onDuplicate,
    onDelete,
    onSave,
  }) => {
    const [value, setValue] = useState(plan.name);
    const [editing, setEditing] = useState(false);

    useEffect(() => {
      setValue(plan.name);
    }, [plan.id]);

    const commitEdit = () => {
      setEditing(false);
      if (value.trim() && value !== plan.name) onRename(value.trim());
    };

    const label = plan.departureIcao && plan.destinationIcao
      ? `${plan.departureIcao} → ${plan.destinationIcao}`
      : plan.departureIcao || plan.destinationIcao || '';

    return (
      <div className="kfp-pill kfp-surface-thick">
        {editing ? (
          <Input
            value={value}
            autoFocus
            onChange={(e: any) => setValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') {
                setValue(plan.name);
                setEditing(false);
              }
            }}
            style={{
              height: 28,
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: 15,
              fontWeight: 500,
              minWidth: 180,
              outline: 'none',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'text',
              color: 'inherit',
              font: 'inherit',
              letterSpacing: '-0.011em',
            }}
            title="Rename plan"
          >
            {plan.name || 'Untitled plan'}
          </button>
        )}

        {label && <span className="kfp-pill-chip">{label}</span>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Plan menu"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              {MoreHorizontal && <MoreHorizontal className="w-4 h-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ minWidth: 200 }}>
            <DropdownMenuItem onSelect={() => onSave()}>
              {Save && <Save className="w-4 h-4 mr-2" />}
              Save plan
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNew()}>
              {FilePlus && <FilePlus className="w-4 h-4 mr-2" />}
              New plan
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate()}>
              {Copy && <Copy className="w-4 h-4 mr-2" />}
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete()}
              style={{ color: 'rgb(var(--kfp-danger))' }}
            >
              {Trash2 && <Trash2 className="w-4 h-4 mr-2" />}
              Delete plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return PlanPill;
}
