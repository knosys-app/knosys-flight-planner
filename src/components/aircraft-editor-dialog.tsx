import type { FC, ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import type {
  AircraftProfile,
  EnvelopeCorner,
  FuelStation,
  FuelType,
  SharedDependencies,
  WeightStation,
} from '../types';
import {
  DEFAULT_PATTERN_MINUTES,
  DEFAULT_SERVICE_CEILING_FT,
  DEFAULT_TAXI_MINUTES,
} from '../constants';

/**
 * v0.5.3: The aircraft profile editor is now a bottom-sheet takeover
 * (via Shared.Sheet, `side="bottom"`) instead of a centered Dialog —
 * this gives us more vertical room for the new W&B sections and matches
 * the sheet-based UX the rest of the plugin uses.
 *
 * Exported name is still `createAircraftEditorDialog` for import-stability.
 */
export function createAircraftEditorDialog(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    Input,
    Label,
    Button,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    lucideIcons,
  } = Shared;
  const { Plus, Trash2 } = lucideIcons as Record<string, any>;

  const AircraftEditorSheet: FC<{
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

    const update = <K extends keyof AircraftProfile>(
      key: K,
      value: AircraftProfile[K],
    ) => setForm((prev) => ({ ...prev, [key]: value }));

    const onNumber = (key: keyof AircraftProfile) => (e: any) => {
      const raw = e.target.value;
      if (raw === '') {
        update(key, undefined as any);
        return;
      }
      const v = Number.parseFloat(raw);
      if (Number.isFinite(v)) update(key, v as any);
    };

    // Station editor helpers
    const updateStations = (list: WeightStation[]) =>
      setForm((prev) => ({ ...prev, weightStations: list }));
    const updateFuel = (list: FuelStation[]) =>
      setForm((prev) => ({ ...prev, fuelStations: list }));
    const updateEnvelope = (list: EnvelopeCorner[]) =>
      setForm((prev) => ({ ...prev, envelopeCorners: list }));

    const stations = form.weightStations ?? [];
    const tanks = form.fuelStations ?? [];
    const envelope = form.envelopeCorners ?? [];

    return (
      <Sheet open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="kfp-scope flex flex-col p-0"
          style={{ height: '92vh', maxHeight: '92vh', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        >
          <SheetHeader
            style={{
              padding: '16px 24px 12px',
              borderBottom: '1px solid rgb(var(--kfp-hairline))',
            }}
          >
            <SheetTitle>
              {aircraft ? 'Edit aircraft' : 'New aircraft'}
            </SheetTitle>
          </SheetHeader>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <Section title="Identity">
              <Grid cols={2}>
                <Field label="Name / tail number" span={2}>
                  <Input
                    value={form.name}
                    onChange={(e: any) => update('name', e.target.value)}
                  />
                </Field>
                <Field label="Type">
                  <Input
                    value={form.type}
                    onChange={(e: any) => update('type', e.target.value)}
                  />
                </Field>
                <Field label="Fuel type">
                  <Select
                    value={form.fuelType}
                    onValueChange={(v: FuelType) => update('fuelType', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100LL">100LL</SelectItem>
                      <SelectItem value="Jet-A">Jet-A</SelectItem>
                      <SelectItem value="MoGas">MoGas</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </Grid>
            </Section>

            <Section title="Cruise">
              <Grid cols={2}>
                <Field label="Cruise TAS (kt)">
                  <Input
                    type="number"
                    value={form.tasKt}
                    onChange={onNumber('tasKt')}
                  />
                </Field>
                <Field label="Cruise fuel burn (gph)">
                  <Input
                    type="number"
                    value={form.fuelBurnGph}
                    onChange={onNumber('fuelBurnGph')}
                  />
                </Field>
                <Field label="Fuel capacity (gal)">
                  <Input
                    type="number"
                    value={form.fuelCapacityGal}
                    onChange={onNumber('fuelCapacityGal')}
                  />
                </Field>
                <Field label="Reserve (min)">
                  <Input
                    type="number"
                    value={form.reserveMinutes}
                    onChange={onNumber('reserveMinutes')}
                  />
                </Field>
                <Field label="Service ceiling (ft)">
                  <Input
                    type="number"
                    value={form.serviceCeilingFt ?? ''}
                    placeholder={String(DEFAULT_SERVICE_CEILING_FT)}
                    onChange={onNumber('serviceCeilingFt')}
                  />
                </Field>
              </Grid>
            </Section>

            <Section title="Climb">
              <Grid cols={3}>
                <Field label="Climb rate (fpm)">
                  <Input
                    type="number"
                    value={form.climbFpm ?? ''}
                    onChange={onNumber('climbFpm')}
                  />
                </Field>
                <Field label="Climb TAS (kt)">
                  <Input
                    type="number"
                    value={form.climbTasKt ?? ''}
                    onChange={onNumber('climbTasKt')}
                  />
                </Field>
                <Field label="Climb fuel (gph)">
                  <Input
                    type="number"
                    value={form.climbGph ?? ''}
                    onChange={onNumber('climbGph')}
                  />
                </Field>
              </Grid>
            </Section>

            <Section title="Descent">
              <Grid cols={3}>
                <Field label="Descent rate (fpm)">
                  <Input
                    type="number"
                    value={form.descentFpm ?? ''}
                    onChange={onNumber('descentFpm')}
                  />
                </Field>
                <Field label="Descent TAS (kt)">
                  <Input
                    type="number"
                    value={form.descentTasKt ?? ''}
                    onChange={onNumber('descentTasKt')}
                  />
                </Field>
                <Field label="Descent fuel (gph)">
                  <Input
                    type="number"
                    value={form.descentGph ?? ''}
                    onChange={onNumber('descentGph')}
                  />
                </Field>
              </Grid>
            </Section>

            <Section title="Block time">
              <Grid cols={3}>
                <Field label="Taxi (min)">
                  <Input
                    type="number"
                    value={form.taxiMinutes ?? ''}
                    placeholder={String(DEFAULT_TAXI_MINUTES)}
                    onChange={onNumber('taxiMinutes')}
                  />
                </Field>
                <Field label="Taxi fuel (gph)">
                  <Input
                    type="number"
                    value={form.taxiGph ?? ''}
                    onChange={onNumber('taxiGph')}
                  />
                </Field>
                <Field label="Pattern (min)">
                  <Input
                    type="number"
                    value={form.patternMinutes ?? ''}
                    placeholder={String(DEFAULT_PATTERN_MINUTES)}
                    onChange={onNumber('patternMinutes')}
                  />
                </Field>
              </Grid>
            </Section>

            <Section title="Weight & balance basics">
              <Grid cols={4}>
                <Field label="Empty weight (lb)">
                  <Input
                    type="number"
                    value={form.emptyWeightLb ?? ''}
                    onChange={onNumber('emptyWeightLb')}
                  />
                </Field>
                <Field label="Empty CG (in)">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.emptyCgIn ?? ''}
                    onChange={onNumber('emptyCgIn')}
                  />
                </Field>
                <Field label="Max gross (lb)">
                  <Input
                    type="number"
                    value={form.maxGrossWeightLb ?? ''}
                    onChange={onNumber('maxGrossWeightLb')}
                  />
                </Field>
                <Field label="Max baggage (lb)">
                  <Input
                    type="number"
                    value={form.maxBaggageWeightLb ?? ''}
                    onChange={onNumber('maxBaggageWeightLb')}
                  />
                </Field>
              </Grid>
            </Section>

            <Section
              title="Weight stations"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateStations([
                      ...stations,
                      { id: uuid(), name: 'Station', armIn: 0 },
                    ])
                  }
                >
                  {Plus && <Plus className="w-4 h-4 mr-1" />}Add
                </Button>
              }
            >
              {stations.length === 0 ? (
                <EmptyHint>
                  No stations defined. Add the seats, baggage areas, or
                  equipment positions used by this aircraft's POH.
                </EmptyHint>
              ) : (
                <StationGrid
                  cols={['Name', 'Arm (in)', 'Max (lb)', 'Default (lb)', '']}
                >
                  {stations.map((s, idx) => (
                    <StationGridRow key={s.id}>
                      <Input
                        value={s.name}
                        onChange={(e: any) =>
                          updateStations(
                            stations.map((x, i) =>
                              i === idx ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="0.1"
                        value={s.armIn}
                        onChange={(e: any) =>
                          updateStations(
                            stations.map((x, i) =>
                              i === idx
                                ? { ...x, armIn: Number.parseFloat(e.target.value) || 0 }
                                : x,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        value={s.maxWeightLb ?? ''}
                        onChange={(e: any) =>
                          updateStations(
                            stations.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    maxWeightLb:
                                      e.target.value === ''
                                        ? undefined
                                        : Number.parseFloat(e.target.value) || 0,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        value={s.defaultWeightLb ?? ''}
                        onChange={(e: any) =>
                          updateStations(
                            stations.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    defaultWeightLb:
                                      e.target.value === ''
                                        ? undefined
                                        : Number.parseFloat(e.target.value) || 0,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          updateStations(stations.filter((_, i) => i !== idx))
                        }
                      >
                        {Trash2 && <Trash2 className="w-4 h-4" />}
                      </Button>
                    </StationGridRow>
                  ))}
                </StationGrid>
              )}
            </Section>

            <Section
              title="Fuel tanks"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateFuel([
                      ...tanks,
                      { id: uuid(), name: 'Tank', armIn: 0, capacityGal: 10 },
                    ])
                  }
                >
                  {Plus && <Plus className="w-4 h-4 mr-1" />}Add
                </Button>
              }
            >
              {tanks.length === 0 ? (
                <EmptyHint>
                  No tanks defined. Add at least one for the W&B editor to
                  include fuel weight.
                </EmptyHint>
              ) : (
                <StationGrid cols={['Name', 'Arm (in)', 'Capacity (gal)', '']}>
                  {tanks.map((t, idx) => (
                    <StationGridRow key={t.id} cols={4}>
                      <Input
                        value={t.name}
                        onChange={(e: any) =>
                          updateFuel(
                            tanks.map((x, i) =>
                              i === idx ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="0.1"
                        value={t.armIn}
                        onChange={(e: any) =>
                          updateFuel(
                            tanks.map((x, i) =>
                              i === idx
                                ? { ...x, armIn: Number.parseFloat(e.target.value) || 0 }
                                : x,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        value={t.capacityGal}
                        onChange={(e: any) =>
                          updateFuel(
                            tanks.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    capacityGal:
                                      Number.parseFloat(e.target.value) || 0,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          updateFuel(tanks.filter((_, i) => i !== idx))
                        }
                      >
                        {Trash2 && <Trash2 className="w-4 h-4" />}
                      </Button>
                    </StationGridRow>
                  ))}
                </StationGrid>
              )}
            </Section>

            <Section
              title="CG envelope corners"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateEnvelope([...envelope, { weightLb: 1500, cgIn: 40 }])
                  }
                >
                  {Plus && <Plus className="w-4 h-4 mr-1" />}Add corner
                </Button>
              }
            >
              {envelope.length === 0 ? (
                <EmptyHint>
                  Add at least 3 corners to define the envelope polygon.
                  Corners should be ordered to form a closed ring around the
                  acceptable CG-weight region.
                </EmptyHint>
              ) : (
                <StationGrid cols={['Weight (lb)', 'CG (in)', '']}>
                  {envelope.map((c, idx) => (
                    <StationGridRow key={idx} cols={3}>
                      <Input
                        type="number"
                        value={c.weightLb}
                        onChange={(e: any) =>
                          updateEnvelope(
                            envelope.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    weightLb:
                                      Number.parseFloat(e.target.value) || 0,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="0.1"
                        value={c.cgIn}
                        onChange={(e: any) =>
                          updateEnvelope(
                            envelope.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    cgIn:
                                      Number.parseFloat(e.target.value) || 0,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          updateEnvelope(envelope.filter((_, i) => i !== idx))
                        }
                      >
                        {Trash2 && <Trash2 className="w-4 h-4" />}
                      </Button>
                    </StationGridRow>
                  ))}
                </StationGrid>
              )}
            </Section>
          </div>

          <footer
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 24px',
              borderTop: '1px solid rgb(var(--kfp-hairline))',
              background: 'rgb(var(--kfp-surface-tint) / 0.6)',
            }}
          >
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await onSave({ ...form, schemaVersion: 3 });
                onClose();
              }}
            >
              Save
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
    );
  };

  return AircraftEditorSheet;
}

// ---------- layout helpers ----------

const Section: FC<{ title: string; action?: ReactNode; children: ReactNode }> = ({
  title,
  action,
  children,
}) => (
  <section>
    <div
      className="kfp-label-caps"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <span>{title}</span>
      {action}
    </div>
    {children}
  </section>
);

const Grid: FC<{ cols: number; children: ReactNode }> = ({ cols, children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap: 12,
    }}
  >
    {children}
  </div>
);

const Field: FC<{ label: string; span?: number; children: ReactNode }> = ({
  label,
  span,
  children,
}) => (
  <div style={span ? { gridColumn: `span ${span}` } : undefined}>
    <div
      style={{
        fontSize: 12,
        fontWeight: 500,
        marginBottom: 4,
        color: 'rgb(var(--kfp-fg-muted))',
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

const StationGrid: FC<{ cols: string[]; children: ReactNode }> = ({
  cols,
  children,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols.length - 1}, minmax(0, 1fr)) auto`,
      gap: 8,
      fontSize: 12,
    }}
  >
    {cols.map((c, i) => (
      <div
        key={i}
        style={{
          fontSize: 11,
          color: 'rgb(var(--kfp-fg-muted))',
          padding: '0 4px',
        }}
      >
        {c}
      </div>
    ))}
    {children}
  </div>
);

const StationGridRow: FC<{ cols?: number; children: ReactNode }> = ({
  children,
}) => <>{children}</>;

const EmptyHint: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: '12px 14px',
      borderRadius: 10,
      background: 'rgb(var(--kfp-fg) / 0.04)',
      fontSize: 12,
      color: 'rgb(var(--kfp-fg-muted))',
      lineHeight: 1.5,
    }}
  >
    {children}
  </div>
);

function defaultForm(): AircraftProfile {
  return {
    schemaVersion: 3,
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
    emptyWeightLb: 1680,
    emptyCgIn: 39.9,
    maxGrossWeightLb: 2550,
    maxBaggageWeightLb: 120,
    weightStations: [],
    fuelStations: [],
    envelopeCorners: [],
  };
}
