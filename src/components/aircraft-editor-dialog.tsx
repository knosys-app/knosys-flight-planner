import type { FC } from 'react';
import { v4 as uuid } from 'uuid';
import type { AircraftProfile, FuelType, SharedDependencies } from '../types';
import {
  DEFAULT_PATTERN_MINUTES,
  DEFAULT_SERVICE_CEILING_FT,
  DEFAULT_TAXI_MINUTES,
} from '../constants';

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
      aircraft ?? defaultForm(),
    );

    useEffect(() => {
      if (aircraft) setForm(aircraft);
    }, [aircraft?.id]);

    const update = <K extends keyof AircraftProfile>(key: K, value: AircraftProfile[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

    const onNumber = (key: keyof AircraftProfile) => (e: any) => {
      const raw = e.target.value;
      if (raw === '') {
        update(key, undefined as any);
        return;
      }
      const v = Number.parseFloat(raw);
      if (Number.isFinite(v)) update(key, v as any);
    };

    return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <DialogContent className="max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
          <DialogHeader>
            <DialogTitle>{aircraft ? 'Edit aircraft' : 'New aircraft'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto -mx-1 px-1 space-y-5">
            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Identity
              </div>
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
              </div>
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Cruise
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cruise TAS (kt)</Label>
                  <Input type="number" value={form.tasKt} onChange={onNumber('tasKt')} />
                </div>
                <div>
                  <Label>Cruise fuel burn (gph)</Label>
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
                  <Label>Service ceiling (ft)</Label>
                  <Input
                    type="number"
                    value={form.serviceCeilingFt ?? ''}
                    placeholder={String(DEFAULT_SERVICE_CEILING_FT)}
                    onChange={onNumber('serviceCeilingFt')}
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Climb
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Climb rate (fpm)</Label>
                  <Input type="number" value={form.climbFpm ?? ''} onChange={onNumber('climbFpm')} />
                </div>
                <div>
                  <Label>Climb TAS (kt)</Label>
                  <Input type="number" value={form.climbTasKt ?? ''} onChange={onNumber('climbTasKt')} />
                </div>
                <div>
                  <Label>Climb fuel (gph)</Label>
                  <Input type="number" value={form.climbGph ?? ''} onChange={onNumber('climbGph')} />
                </div>
              </div>
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Descent
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Descent rate (fpm)</Label>
                  <Input type="number" value={form.descentFpm ?? ''} onChange={onNumber('descentFpm')} />
                </div>
                <div>
                  <Label>Descent TAS (kt)</Label>
                  <Input type="number" value={form.descentTasKt ?? ''} onChange={onNumber('descentTasKt')} />
                </div>
                <div>
                  <Label>Descent fuel (gph)</Label>
                  <Input type="number" value={form.descentGph ?? ''} onChange={onNumber('descentGph')} />
                </div>
              </div>
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Block time
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Taxi (min)</Label>
                  <Input
                    type="number"
                    value={form.taxiMinutes ?? ''}
                    placeholder={String(DEFAULT_TAXI_MINUTES)}
                    onChange={onNumber('taxiMinutes')}
                  />
                </div>
                <div>
                  <Label>Taxi fuel (gph)</Label>
                  <Input type="number" value={form.taxiGph ?? ''} onChange={onNumber('taxiGph')} />
                </div>
                <div>
                  <Label>Pattern (min)</Label>
                  <Input
                    type="number"
                    value={form.patternMinutes ?? ''}
                    placeholder={String(DEFAULT_PATTERN_MINUTES)}
                    onChange={onNumber('patternMinutes')}
                  />
                </div>
              </div>
            </section>
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

function defaultForm(): AircraftProfile {
  return {
    schemaVersion: 2,
    id: uuid(),
    name: 'N12345',
    type: 'C172S',
    tasKt: 120,
    fuelBurnGph: 8.5,
    fuelCapacityGal: 53,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 700,
    climbTasKt: 75,
    climbGph: 10,
    descentFpm: 500,
    descentTasKt: 110,
    descentGph: 6,
    taxiMinutes: DEFAULT_TAXI_MINUTES,
    taxiGph: 2.5,
    patternMinutes: DEFAULT_PATTERN_MINUTES,
    serviceCeilingFt: DEFAULT_SERVICE_CEILING_FT,
  };
}
