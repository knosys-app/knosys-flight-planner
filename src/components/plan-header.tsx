import type { FC } from 'react';
import type { SharedDependencies } from '../types';
import type { FlightPlannerStore } from '../hooks/use-flight-planner-store';

export function createPlanHeader(Shared: SharedDependencies) {
  const { useState, useEffect, Input, Button, lucideIcons } = Shared;
  const { Save, Copy, FilePlus, Trash2 } = lucideIcons as Record<string, any>;

  const PlanHeader: FC<{
    store: FlightPlannerStore;
    onSave: () => void;
    onNew: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
  }> = ({ store, onSave, onNew, onDuplicate, onDelete }) => {
    const [name, setName] = useState(store.plan?.name ?? '');

    useEffect(() => {
      setName(store.plan?.name ?? '');
    }, [store.plan?.id]);

    return (
      <div className="flex items-center gap-2 p-3 border-b">
        <Input
          className="flex-1 text-lg font-semibold"
          value={name}
          onChange={(e: any) => {
            setName(e.target.value);
            store.setPlanName(e.target.value);
          }}
          placeholder="Untitled plan"
        />
        <Button size="sm" variant="ghost" onClick={onNew} title="New plan">
          {FilePlus && <FilePlus className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicate} title="Duplicate">
          {Copy && <Copy className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} title="Delete">
          {Trash2 && <Trash2 className="w-4 h-4" />}
        </Button>
        <Button size="sm" onClick={onSave}>
          {Save && <Save className="w-4 h-4 mr-1" />} Save
        </Button>
      </div>
    );
  };

  return PlanHeader;
}
