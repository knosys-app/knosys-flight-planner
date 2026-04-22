import type { FC } from 'react';
import type { AircraftProfile, SharedDependencies } from '../types';

export function createAircraftPicker(Shared: SharedDependencies) {
  const { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button, lucideIcons } = Shared;
  const { Pencil } = lucideIcons as Record<string, any>;

  const AircraftPicker: FC<{
    aircraft: AircraftProfile[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onEdit: () => void;
  }> = ({ aircraft, selectedId, onSelect, onEdit }) => {
    return (
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
          minWidth: 0,
        }}
      >
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <Select value={selectedId ?? undefined} onValueChange={onSelect}>
            <SelectTrigger style={{ width: '100%', minWidth: 0 }}>
              <SelectValue placeholder="Choose aircraft" />
            </SelectTrigger>
            <SelectContent>
              {aircraft.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {a.type} · {a.tasKt} kt · {a.fuelBurnGph} gph
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onEdit}
          title="Edit profile"
          style={{ flex: '0 0 auto' }}
        >
          {Pencil && <Pencil className="w-4 h-4" />}
        </Button>
      </div>
    );
  };

  return AircraftPicker;
}
