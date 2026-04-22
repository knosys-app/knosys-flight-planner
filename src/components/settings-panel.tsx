import type { FC } from 'react';
import type { AircraftProfile, PluginSettings, SharedDependencies } from '../types';
import { getSettings, saveSettings } from '../store/settings-store';
import { deleteAircraft, listAircraft, saveAircraft } from '../store/aircraft-store';
import { getAirportsDbSize, isAirportsDbInstalled } from '../data/first-run-download';
import { createAircraftEditorDialog } from './aircraft-editor-dialog';
import { createFirstRunModal } from './first-run-modal';
import { createMapCacheCard } from './map-cache-card';

export function createSettingsPanel(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Button,
    Label,
    Switch,
    Input,
  } = Shared;
  const AircraftEditorDialog = createAircraftEditorDialog(Shared);
  const AirportDbModal = createFirstRunModal(Shared);
  const MapCacheCard = createMapCacheCard(Shared);

  const SettingsPanel: FC = () => {
    const [settings, setSettings] = useState<PluginSettings | null>(null);
    const [aircraft, setAircraft] = useState<AircraftProfile[]>([]);
    const [editing, setEditing] = useState<AircraftProfile | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [dbModalOpen, setDbModalOpen] = useState(false);
    const [dbInstalled, setDbInstalled] = useState(false);
    const [dbSizeBytes, setDbSizeBytes] = useState<number | null>(null);

    const refresh = async () => {
      const [s, a, installed, size] = await Promise.all([
        getSettings(),
        listAircraft(),
        isAirportsDbInstalled(),
        getAirportsDbSize(),
      ]);
      setSettings(s);
      setAircraft(a);
      setDbInstalled(installed);
      setDbSizeBytes(size);
    };

    useEffect(() => {
      void refresh();
    }, []);

    if (!settings) return <div className="p-4">Loading…</div>;

    const update = async (patch: Partial<PluginSettings>) => {
      const next = await saveSettings(patch);
      setSettings(next);
    };

    return (
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Units</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Metric units</Label>
                <div className="text-xs text-muted-foreground">
                  When enabled: km/h, km, meters, liters, °C. Off = knots, nm, feet, gallons, °F.
                </div>
              </div>
              <Switch
                checked={settings.units === 'metric'}
                onCheckedChange={(v: boolean) => void update({ units: v ? 'metric' : 'us' })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div>
              <Label>Default cruise altitude (ft)</Label>
              <Input
                type="number"
                value={settings.defaultCruiseAltFt}
                onChange={(e: any) =>
                  void update({
                    defaultCruiseAltFt: Number.parseInt(e.target.value, 10) || 5500,
                  })
                }
              />
            </div>
            <div>
              <Label>Default fuel reserve (min)</Label>
              <Input
                type="number"
                value={settings.defaultReserveMinutes}
                onChange={(e: any) =>
                  void update({
                    defaultReserveMinutes: Number.parseInt(e.target.value, 10) || 45,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Airport database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                {dbInstalled ? (
                  <>
                    <div className="text-green-600">✓ Installed</div>
                    <div className="text-xs text-muted-foreground">
                      {dbSizeBytes != null
                        ? `${(dbSizeBytes / 1_000_000).toFixed(1)} MB`
                        : 'size unknown'}
                      {settings.airportsDbInstalledAt
                        ? ` · ${new Date(settings.airportsDbInstalledAt).toLocaleDateString()}`
                        : ''}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">Not installed</div>
                    <div className="text-xs text-muted-foreground">
                      Airport search and navlog require this ~18 MB database.
                    </div>
                  </>
                )}
              </div>
              <Button variant={dbInstalled ? 'outline' : 'default'} onClick={() => setDbModalOpen(true)}>
                {dbInstalled ? 'Manage' : 'Install'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <MapCacheCard />

        <Card>
          <CardHeader>
            <CardTitle>Aircraft profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {aircraft.map((a) => (
                <div key={a.id} className="flex items-center gap-2 border rounded p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.type} · {a.tasKt} kt · {a.fuelBurnGph} gph · {a.fuelCapacityGal} gal
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(a);
                      setEditorOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await deleteAircraft(a.id);
                      await refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
              >
                Add aircraft
              </Button>
            </div>
          </CardContent>
        </Card>

        <AircraftEditorDialog
          open={editorOpen}
          aircraft={editing}
          onClose={() => setEditorOpen(false)}
          onSave={async (a) => {
            await saveAircraft(a);
            await refresh();
          }}
        />

        <AirportDbModal
          open={dbModalOpen}
          onClose={() => {
            setDbModalOpen(false);
            void refresh();
          }}
        />
      </div>
    );
  };

  return SettingsPanel;
}
