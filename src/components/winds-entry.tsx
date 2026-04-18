import type { FC } from 'react';
import type { SharedDependencies, WindsEntryRow } from '../types';

export function createWindsEntry(Shared: SharedDependencies) {
  const { useState, Input, Label, Button, lucideIcons } = Shared;
  const { Plus, X } = lucideIcons as Record<string, any>;

  const WindsEntry: FC<{
    winds: WindsEntryRow[];
    onChange: (next: WindsEntryRow[]) => void;
  }> = ({ winds, onChange }) => {
    const [draft, setDraft] = useState<Partial<WindsEntryRow>>({
      altFt: 5500,
      dirTrueDeg: 270,
      speedKt: 10,
    });

    const add = () => {
      if (
        draft.altFt === undefined ||
        draft.dirTrueDeg === undefined ||
        draft.speedKt === undefined
      )
        return;
      const next = [
        ...winds,
        {
          altFt: Number(draft.altFt),
          dirTrueDeg: Number(draft.dirTrueDeg),
          speedKt: Number(draft.speedKt),
          tempC: draft.tempC !== undefined ? Number(draft.tempC) : undefined,
        },
      ].sort((a, b) => a.altFt - b.altFt);
      onChange(next);
      setDraft({
        altFt: Number(draft.altFt) + 3000,
        dirTrueDeg: draft.dirTrueDeg,
        speedKt: draft.speedKt,
      });
    };

    const remove = (altFt: number) => {
      onChange(winds.filter((w) => w.altFt !== altFt));
    };

    return (
      <div className="space-y-2">
        <Label>Winds aloft</Label>
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end text-xs">
          <div>
            <Label className="text-xs">Altitude (ft)</Label>
            <Input
              type="number"
              value={draft.altFt ?? ''}
              onChange={(e: any) =>
                setDraft({ ...draft, altFt: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Dir (\u00B0T)</Label>
            <Input
              type="number"
              value={draft.dirTrueDeg ?? ''}
              onChange={(e: any) =>
                setDraft({ ...draft, dirTrueDeg: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Speed (kt)</Label>
            <Input
              type="number"
              value={draft.speedKt ?? ''}
              onChange={(e: any) =>
                setDraft({ ...draft, speedKt: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Temp (\u00B0C)</Label>
            <Input
              type="number"
              value={draft.tempC ?? ''}
              onChange={(e: any) =>
                setDraft({ ...draft, tempC: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
          <Button size="sm" onClick={add} title="Add">
            {Plus && <Plus className="w-4 h-4" />}
          </Button>
        </div>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="px-2 py-1 text-left">Alt (ft)</th>
                <th className="px-2 py-1 text-left">Dir \u00B0T</th>
                <th className="px-2 py-1 text-left">Kt</th>
                <th className="px-2 py-1 text-left">\u00B0C</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {winds.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-2 text-center text-muted-foreground">
                    No winds entered \u2014 add one row per altitude
                  </td>
                </tr>
              )}
              {winds.map((w) => (
                <tr key={w.altFt} className="border-t">
                  <td className="px-2 py-1">{w.altFt.toLocaleString()}</td>
                  <td className="px-2 py-1">{w.dirTrueDeg.toString().padStart(3, '0')}</td>
                  <td className="px-2 py-1">{w.speedKt}</td>
                  <td className="px-2 py-1">{w.tempC ?? ''}</td>
                  <td className="px-2 py-1 text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(w.altFt)} title="Remove">
                      {X && <X className="w-3 h-3" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return WindsEntry;
}
