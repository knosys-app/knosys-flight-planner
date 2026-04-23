import type { FC } from 'react';
import type { LayerVisibility, PluginSettings, SharedDependencies } from '../../types';
import {
  deleteObstaclesDb,
  downloadObstaclesDb,
  getObstaclesDbSize,
  isObstaclesDbInstalled,
} from '../../obstacles/obstacle-download';
import { resetObstacleProvider } from '../../obstacles/use-obstacle-provider';

/** Layer visibility defaults — used when `settings.layers[key]` is undefined. */
export const LAYER_DEFAULTS: Required<LayerVisibility> = {
  airports: true,
  navaids: false,
  airspace: false,
};

export function resolveLayerVisibility(settings: PluginSettings): Required<LayerVisibility> {
  const l = settings.layers ?? {};
  return {
    airports: l.airports ?? LAYER_DEFAULTS.airports,
    navaids: l.navaids ?? LAYER_DEFAULTS.navaids,
    airspace: l.airspace ?? LAYER_DEFAULTS.airspace,
  };
}

export interface LayersButtonProps {
  settings: PluginSettings;
  onSettingsChange: (patch: Partial<PluginSettings>) => Promise<void> | void;
}

/**
 * Top-right layers menu. Toggles map layers (airports, navaids, airspace,
 * obstacles) plus placeholder rows for layers landing in later phases
 * (satellite, sectional, terrain tints). Obstacle DB install lives here
 * per the v0.3 relocation.
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

  const LayerRow: FC<{
    title: string;
    meta?: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
    swatch?: string;
  }> = ({ title, meta, checked, disabled, onChange, swatch }) => (
    <div className="kfp-layers-item">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {swatch && (
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: swatch,
              flex: '0 0 auto',
              boxShadow: '0 0 0 1px rgb(var(--kfp-hairline))',
            }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap' }}>{title}</span>
          {meta && <span className="kfp-layers-item-meta">{meta}</span>}
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );

  const LayersButton: FC<LayersButtonProps> = ({ settings, onSettingsChange }) => {
    const [installed, setInstalled] = useState(false);
    const [sizeMb, setSizeMb] = useState<number | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState<{ loaded: number; total: number | null } | null>(
      null,
    );
    const [error, setError] = useState<string | null>(null);

    const layers = resolveLayerVisibility(settings);

    const setLayer = (key: keyof LayerVisibility, value: boolean) => {
      void onSettingsChange({
        layers: { ...(settings.layers ?? {}), [key]: value },
      });
    };

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
          <div className="kfp-label-caps" style={{ padding: '6px 12px 4px' }}>
            Aeronautical
          </div>

          <LayerRow
            title="Airports"
            meta="Large · medium · small"
            swatch="#0A84FF"
            checked={layers.airports}
            onChange={(v) => setLayer('airports', v)}
          />
          <LayerRow
            title="Navaids"
            meta="VOR · VOR-DME · NDB"
            swatch="#A855F7"
            checked={layers.navaids}
            onChange={(v) => setLayer('navaids', v)}
          />
          <LayerRow
            title="Airspace (B / C)"
            meta="Derived — not chart-accurate"
            swatch="#FF2D55"
            checked={layers.airspace}
            onChange={(v) => setLayer('airspace', v)}
          />

          <div style={{ borderTop: '1px solid rgb(var(--kfp-hairline))', margin: '6px 8px' }} />

          <div className="kfp-label-caps" style={{ padding: '8px 12px 4px' }}>
            Obstacles
          </div>

          <LayerRow
            title="FAA DOF (US only)"
            meta={
              installed
                ? sizeMb !== null
                  ? `${sizeMb.toFixed(1)} MB installed`
                  : 'Installed'
                : 'Not downloaded'
            }
            swatch="#FF9F0A"
            checked={(settings.obstaclesEnabled ?? false) && installed}
            disabled={!installed}
            onChange={(v) => void onSettingsChange({ obstaclesEnabled: v })}
          />

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

          <div style={{ borderTop: '1px solid rgb(var(--kfp-hairline))', margin: '6px 8px' }} />

          <div className="kfp-label-caps" style={{ padding: '8px 12px 4px' }}>
            Basemap
          </div>
          <div className="kfp-layers-item">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Terrain tints</span>
              <span className="kfp-layers-item-meta">Built-in · always on</span>
            </div>
          </div>
          <div className="kfp-layers-item" style={{ opacity: 0.55 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Satellite</span>
              <span className="kfp-layers-item-meta">Coming soon</span>
            </div>
            <Switch checked={false} disabled />
          </div>
          <div className="kfp-layers-item" style={{ opacity: 0.55 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Sectional overlay</span>
              <span className="kfp-layers-item-meta">Coming soon</span>
            </div>
            <Switch checked={false} disabled />
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return LayersButton;
}
