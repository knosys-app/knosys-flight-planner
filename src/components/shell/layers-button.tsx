import type { FC } from 'react';
import type { PluginSettings, SharedDependencies } from '../../types';
import {
  deleteObstaclesDb,
  downloadObstaclesDb,
  getObstaclesDbSize,
  isObstaclesDbInstalled,
} from '../../obstacles/obstacle-download';
import { resetObstacleProvider } from '../../obstacles/use-obstacle-provider';

export interface LayersButtonProps {
  settings: PluginSettings;
  onSettingsChange: (patch: Partial<PluginSettings>) => Promise<void> | void;
}

/**
 * Top-right layers menu. Houses obstacles opt-in (relocated from settings
 * panel in v0.3) plus placeholder toggles for future layers (Terrain,
 * Satellite, Airspace) that light up in v0.6.
 */
export function createLayersButton(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Switch,
    Button,
    Progress,
    lucideIcons,
  } = Shared;
  const { Layers, Download, Trash2 } = lucideIcons as Record<string, any>;

  const LayersButton: FC<LayersButtonProps> = ({ settings, onSettingsChange }) => {
    const [installed, setInstalled] = useState(false);
    const [sizeMb, setSizeMb] = useState<number | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState<{ loaded: number; total: number | null } | null>(
      null,
    );
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
        await onSettingsChange({
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
      await onSettingsChange({ obstaclesEnabled: false });
      await refresh();
    };

    const pct = progress?.total
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : null;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Map layers"
            className="kfp-layers-btn kfp-surface-thick"
          >
            {Layers && <Layers className="w-5 h-5" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="kfp-surface-thick kfp-layers-menu"
          style={{ padding: 6 }}
        >
          <div className="kfp-label-caps" style={{ padding: '6px 12px 8px' }}>
            Map layers
          </div>

          <div className="kfp-layers-item">
            <span>Terrain tints</span>
            <span className="kfp-layers-item-meta">Built-in</span>
          </div>

          <div style={{ borderTop: '1px solid rgb(var(--kfp-hairline))', margin: '4px 8px' }} />

          <div className="kfp-label-caps" style={{ padding: '10px 12px 6px' }}>
            Obstacles
          </div>

          <div className="kfp-layers-item">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>FAA DOF (US only)</span>
              <span className="kfp-layers-item-meta">
                {installed
                  ? sizeMb !== null
                    ? `${sizeMb.toFixed(1)} MB installed`
                    : 'Installed'
                  : 'Not downloaded'}
              </span>
            </div>
            <Switch
              checked={(settings.obstaclesEnabled ?? false) && installed}
              disabled={!installed}
              onCheckedChange={(v: boolean) => void onSettingsChange({ obstaclesEnabled: v })}
            />
          </div>

          {!installed && (
            <div style={{ padding: '4px 8px 8px' }}>
              <Button
                size="sm"
                onClick={() => void download()}
                disabled={downloading}
                style={{ width: '100%' }}
              >
                {Download && <Download className="w-4 h-4 mr-1" />}
                {downloading ? 'Downloading…' : 'Download (~4 MB)'}
              </Button>
              {progress && (
                <div style={{ marginTop: 8 }}>
                  {pct !== null && <Progress value={pct} />}
                  <div style={{ fontSize: 11, marginTop: 4, color: 'rgb(var(--kfp-fg-muted))' }}>
                    {(progress.loaded / (1024 * 1024)).toFixed(2)} MB
                    {progress.total
                      ? ` / ${(progress.total / (1024 * 1024)).toFixed(2)} MB`
                      : ''}
                  </div>
                </div>
              )}
            </div>
          )}

          {installed && (
            <div style={{ padding: '4px 8px 8px' }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void remove()}
                style={{ width: '100%' }}
              >
                {Trash2 && <Trash2 className="w-4 h-4 mr-1" />}
                Remove obstacle DB
              </Button>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '4px 12px 8px',
                fontSize: 11,
                color: 'rgb(var(--kfp-danger))',
              }}
            >
              {error}
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  return LayersButton;
}
