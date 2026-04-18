import type { FC } from 'react';
import type { AircraftProfile, PluginSettings, SharedDependencies } from '../types';
import { getSettings, saveSettings } from '../store/settings-store';
import { deleteAircraft, listAircraft, saveAircraft } from '../store/aircraft-store';
import { createAircraftEditorDialog } from './aircraft-editor-dialog';
import { createRegionPicker } from './region-picker';

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
  const RegionPicker = createRegionPicker(Shared);

  const SettingsPanel: FC = () => {
    const [settings, setSettings] = useState<PluginSettings | null>(null);
    const [aircraft, setAircraft] = useState<AircraftProfile[]>([]);
    const [editing, setEditing] = useState<AircraftProfile | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [regionOpen, setRegionOpen] = useState(false);

    const refresh = async () => {
      const [s, a] = await Promise.all([getSettings(), listAircraft()]);
      setSettings(s);
      setAircraft(a);
    };

    useEffect(() => {
      void refresh();
    }, []);

    if (!settings) return <div className="p-4">Loading\u2026</div>;

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
                  When enabled: km/h, km, meters, liters, \u00B0C. Off = knots, nm, feet, gallons, \u00B0F.
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
            <CardTitle>Map regions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setRegionOpen(true)}>Manage map regions</Button>
          </CardContent>
        </Card>

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
                      {a.type} \u00B7 {a.tasKt} kt \u00B7 {a.fuelBurnGph} gph \u00B7 {a.fuelCapacityGal} gal
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

        <RegionPicker
          open={regionOpen}
          onClose={() => setRegionOpen(false)}
        />
      </div>
    );
  };

  return SettingsPanel;
}
