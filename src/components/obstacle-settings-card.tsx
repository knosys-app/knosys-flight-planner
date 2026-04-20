import type { FC } from 'react';
import type { PluginSettings, SharedDependencies } from '../types';
import {
  deleteObstaclesDb,
  downloadObstaclesDb,
  getObstaclesDbSize,
  isObstaclesDbInstalled,
} from '../obstacles/obstacle-download';
import { resetObstacleProvider } from '../obstacles/use-obstacle-provider';

export interface ObstacleSettingsCardProps {
  settings: PluginSettings;
  onChange: (patch: Partial<PluginSettings>) => Promise<void> | void;
}

export function createObstacleSettingsCard(Shared: SharedDependencies) {
  const { useState, useEffect, Button, Switch, Label, Progress } = Shared;

  const ObstacleSettingsCard: FC<ObstacleSettingsCardProps> = ({ settings, onChange }) => {
    const [installed, setInstalled] = useState(false);
    const [sizeMb, setSizeMb] = useState<number | null>(null);
    const [progress, setProgress] = useState<{ loaded: number; total: number | null } | null>(
      null,
    );
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
      const ok = await isObstaclesDbInstalled();
      setInstalled(ok);
      if (ok) {
        const size = await getObstaclesDbSize();
        setSizeMb(size !== null ? size / (1024 * 1024) : null);
      } else {
        setSizeMb(null);
      }
    };

    useEffect(() => {
      void refresh();
    }, []);

    const download = async () => {
      setDownloading(true);
      setError(null);
      setProgress({ loaded: 0, total: null });
      try {
        await downloadObstaclesDb((p) => setProgress(p));
        await onChange({
          obstaclesEnabled: true,
          obstaclesDbInstalledAt: new Date().toISOString(),
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDownloading(false);
        setProgress(null);
      }
    };

    const remove = async () => {
      await deleteObstaclesDb();
      resetObstacleProvider();
      await onChange({ obstaclesEnabled: false });
      await refresh();
    };

    const pct =
      progress && progress.total
        ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
        : null;

    return (
      <div className="border rounded-md p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium text-sm">Obstacle avoidance</div>
            <div className="text-xs text-muted-foreground">
              Use FAA Digital Obstacle File (US only) to add tower and antenna
              clearance to the auto-altitude selector.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.obstaclesEnabled ?? false}
              onCheckedChange={(v: boolean) => void onChange({ obstaclesEnabled: v })}
              disabled={!installed}
            />
            <Label className="text-sm">
              {installed ? 'Enabled' : 'Download the database to enable'}
            </Label>
          </div>
          {installed && sizeMb !== null && (
            <span className="text-xs text-muted-foreground">
              {sizeMb.toFixed(1)} MB installed
            </span>
          )}
        </div>

        {!installed && (
          <Button size="sm" onClick={() => void download()} disabled={downloading}>
            {downloading ? 'Downloading…' : 'Download obstacle database (~4 MB)'}
          </Button>
        )}

        {installed && (
          <Button size="sm" variant="outline" onClick={() => void remove()}>
            Remove obstacle database
          </Button>
        )}

        {progress && (
          <div className="space-y-1">
            {pct !== null && <Progress value={pct} />}
            <div className="text-xs text-muted-foreground">
              {(progress.loaded / (1024 * 1024)).toFixed(2)} MB
              {progress.total && ` / ${(progress.total / (1024 * 1024)).toFixed(2)} MB`}
            </div>
          </div>
        )}

        {error && <div className="text-xs text-red-700">Error: {error}</div>}
      </div>
    );
  };

  return ObstacleSettingsCard;
}
