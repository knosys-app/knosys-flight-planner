import type { FC } from 'react';
import type { AircraftProfile, SharedDependencies } from '../types';

export function createAircraftPicker(Shared: SharedDependencies) {
  const { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button, Label, lucideIcons } = Shared;
  const { Pencil } = lucideIcons as Record<string, any>;

  const AircraftPicker: FC<{
    aircraft: AircraftProfile[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onEdit: () => void;
  }> = ({ aircraft, selectedId, onSelect, onEdit }) => {
    return (
      <div className="space-y-2">
        <Label>Aircraft</Label>
        <div className="flex gap-2">
          <Select value={selectedId ?? undefined} onValueChange={onSelect}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Choose aircraft" />
            </SelectTrigger>
            <SelectContent>
              {aircraft.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {a.type} \u00B7 {a.tasKt} kt \u00B7 {a.fuelBurnGph} gph
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onEdit} title="Edit profile">
            {Pencil && <Pencil className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  };

  return AircraftPicker;
}
