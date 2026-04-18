import type { FC } from 'react';
import type { SharedDependencies } from '../types';
import { deleteRegion, listRegions } from '../store/region-store';
import type { MapRegion } from '../schemas/region-schema';
import { clearMapCache, getCacheStats } from '../map/tile-cache';
import { createRegionPicker } from './region-picker';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function createMapCacheCard(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    useCallback,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Button,
  } = Shared;

  const RegionPicker = createRegionPicker(Shared);

  const MapCacheCard: FC = () => {
    const [regions, setRegions] = useState<MapRegion[]>([]);
    const [stats, setStats] = useState<{ count: number; bytes: number }>({
      count: 0,
      bytes: 0,
    });
    const [pickerOpen, setPickerOpen] = useState(false);
    const [clearing, setClearing] = useState(false);

    const refresh = useCallback(async () => {
      const [r, s] = await Promise.all([listRegions(), getCacheStats()]);
      setRegions(r);
      setStats(s);
    }, []);

    useEffect(() => {
      void refresh();
    }, [refresh]);

    const onClearAll = async () => {
      if (!confirm('Delete all cached map tiles? This cannot be undone.')) return;
      setClearing(true);
      try {
        await clearMapCache();
        for (const region of regions) {
          await deleteRegion(region.id);
        }
        await refresh();
      } finally {
        setClearing(false);
      }
    };

    const onDeleteRegion = async (region: MapRegion) => {
      if (!confirm(`Remove region "${region.name}" metadata? Tiles stay cached unless you Clear all map cache.`)) return;
      await deleteRegion(region.id);
      await refresh();
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Offline map cache</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <div>
              <span className="font-medium">{stats.count.toLocaleString()}</span> tiles cached
              {' · '}
              <span className="font-medium">{formatBytes(stats.bytes)}</span> on disk
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Tiles are fetched from the Protomaps daily planet build and stored in the
              browser's Origin Private File System (OPFS). Panning the map online
              auto-caches tiles; use the button below to pre-download a region.
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setPickerOpen(true)}>Download a region</Button>
            <Button
              variant="outline"
              onClick={() => void onClearAll()}
              disabled={stats.count === 0 || clearing}
            >
              {clearing ? 'Clearing…' : 'Clear map cache'}
            </Button>
          </div>

          {regions.length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="text-sm font-medium">Installed regions</div>
              {regions.map((r) => (
                <div key={r.id} className="flex items-center gap-2 border rounded p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Z{r.zoomMin}–Z{r.zoomMax} ·{' '}
                      {r.downloadedTiles.toLocaleString()} / {r.totalTiles.toLocaleString()} tiles ·{' '}
                      {formatBytes(r.sizeBytes)} ·{' '}
                      {new Date(r.installedAt).toLocaleDateString()}
                    </div>
                    {r.status === 'error' && r.lastError && (
                      <div className="text-xs text-red-600 mt-1">{r.lastError}</div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void onDeleteRegion(r)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <RegionPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onInstalled={() => void refresh()}
        />
      </Card>
    );
  };

  return MapCacheCard;
}
