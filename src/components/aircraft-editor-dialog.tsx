import type { FC } from 'react';
import { v4 as uuid } from 'uuid';
import type { AircraftProfile, FuelType, SharedDependencies } from '../types';

export function createAircraftEditorDialog(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Input,
    Label,
    Button,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } = Shared;

  const AircraftEditorDialog: FC<{
    open: boolean;
    aircraft: AircraftProfile | null;
    onClose: () => void;
    onSave: (aircraft: AircraftProfile) => Promise<void>;
  }> = ({ open, aircraft, onClose, onSave }) => {
    const [form, setForm] = useState<AircraftProfile>(() =>
      aircraft ?? {
        schemaVersion: 1,
        id: uuid(),
        name: 'N12345',
        type: 'C172S',
        tasKt: 120,
        fuelBurnGph: 8.5,
        fuelCapacityGal: 53,
        fuelType: '100LL',
        reserveMinutes: 45,
      },
    );

    useEffect(() => {
      if (aircraft) setForm(aircraft);
    }, [aircraft?.id]);

    const update = <K extends keyof AircraftProfile>(key: K, value: AircraftProfile[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

    const onNumber = (key: keyof AircraftProfile) => (e: any) => {
      const v = Number.parseFloat(e.target.value);
      if (Number.isFinite(v)) update(key, v as any);
    };

    return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{aircraft ? 'Edit aircraft' : 'New aircraft'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name / tail number</Label>
              <Input value={form.name} onChange={(e: any) => update('name', e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Input value={form.type} onChange={(e: any) => update('type', e.target.value)} />
            </div>
            <div>
              <Label>Fuel type</Label>
              <Select value={form.fuelType} onValueChange={(v: FuelType) => update('fuelType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100LL">100LL</SelectItem>
                  <SelectItem value="Jet-A">Jet-A</SelectItem>
                  <SelectItem value="MoGas">MoGas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>TAS (kt)</Label>
              <Input type="number" value={form.tasKt} onChange={onNumber('tasKt')} />
            </div>
            <div>
              <Label>Fuel burn (gph)</Label>
              <Input type="number" value={form.fuelBurnGph} onChange={onNumber('fuelBurnGph')} />
            </div>
            <div>
              <Label>Fuel capacity (gal)</Label>
              <Input type="number" value={form.fuelCapacityGal} onChange={onNumber('fuelCapacityGal')} />
            </div>
            <div>
              <Label>Reserve (min)</Label>
              <Input type="number" value={form.reserveMinutes} onChange={onNumber('reserveMinutes')} />
            </div>
            <div>
              <Label>Climb (fpm)</Label>
              <Input
                type="number"
                value={form.climbFpm ?? ''}
                onChange={(e: any) => update('climbFpm', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Label>Climb TAS (kt)</Label>
              <Input
                type="number"
                value={form.climbTasKt ?? ''}
                onChange={(e: any) => update('climbTasKt', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await onSave(form);
                onClose();
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return AircraftEditorDialog;
}
