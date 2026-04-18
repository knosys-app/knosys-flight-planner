import type { FC } from 'react';
import type { SharedDependencies } from '../types';
import {
  PRESET_REGIONS,
  ZOOM_PRESETS,
  type ZoomPresetKey,
} from '../constants';
import { estimateBytes, estimateTileCount } from '../map/offline-tile-math';
import { resolvePlanetUrl } from '../map/planet-url';
import {
  installCachedPmtilesProtocol,
  isCachedPmtilesProtocolInstalled,
} from '../map/cached-pmtiles-protocol';
import { startRegionDownload, type DownloadProgress } from '../map/region-download';
import { saveRegion } from '../store/region-store';

const PRESET_KEYS: ZoomPresetKey[] = ['low', 'medium', 'high'];

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function createRegionPicker(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    useMemo,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Button,
    Label,
    Progress,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Tabs,
    TabsList,
    TabsTrigger,
  } = Shared;

  type Phase =
    | { kind: 'idle' }
    | { kind: 'resolving' }
    | { kind: 'downloading'; progress: DownloadProgress }
    | { kind: 'done'; progress: DownloadProgress }
    | { kind: 'error'; error: string };

  const RegionPicker: FC<{
    open: boolean;
    onClose: () => void;
    onInstalled?: () => void;
  }> = ({ open, onClose, onInstalled }) => {
    const [regionId, setRegionId] = useState(PRESET_REGIONS[0].id);
    const [zoomKey, setZoomKey] = useState<ZoomPresetKey>('medium');
    const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

    useEffect(() => {
      if (!open) setPhase({ kind: 'idle' });
    }, [open]);

    const region = PRESET_REGIONS.find((r) => r.id === regionId) ?? PRESET_REGIONS[0];
    const zoom = ZOOM_PRESETS[zoomKey];

    const estimate = useMemo(() => {
      const tileCount = estimateTileCount(region.bbox, zoom.min, zoom.max);
      return { tileCount, bytes: estimateBytes(tileCount) };
    }, [region, zoom]);

    const start = async () => {
      setPhase({ kind: 'resolving' });
      try {
        const planetUrl = await resolvePlanetUrl();
        if (!isCachedPmtilesProtocolInstalled()) {
          await installCachedPmtilesProtocol(planetUrl);
        }
        const handle = startRegionDownload(
          region.bbox,
          zoom.min,
          zoom.max,
          (progress) => setPhase({ kind: 'downloading', progress }),
        );
        const result = await handle.promise;
        await saveRegion({
          schemaVersion: 1,
          id: region.id,
          name: region.name,
          bbox: region.bbox as [number, number, number, number],
          zoomMin: zoom.min,
          zoomMax: zoom.max,
          totalTiles: result.total,
          downloadedTiles: result.loaded + result.skipped,
          sizeBytes: result.bytes,
          installedAt: new Date().toISOString(),
          status: result.errors > 0 && result.loaded === 0 ? 'error' : 'complete',
          lastError: result.errors > 0 ? `${result.errors} tile error(s)` : undefined,
        });
        setPhase({ kind: 'done', progress: result });
        onInstalled?.();
      } catch (err) {
        setPhase({ kind: 'error', error: String((err as Error).message ?? err) });
      }
    };

    const pct = (() => {
      if (phase.kind !== 'downloading') return 0;
      const done = phase.progress.loaded + phase.progress.skipped + phase.progress.errors;
      return Math.min(100, Math.round((done / Math.max(1, phase.progress.total)) * 100));
    })();

    const busy = phase.kind === 'resolving' || phase.kind === 'downloading';

    return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && !busy && onClose()}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Download offline map region</DialogTitle>
            <DialogDescription>
              Streams tiles from the Protomaps daily planet build and caches them in
              OPFS for offline use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 overflow-auto -mx-1 px-1">
            <div>
              <Label>Region</Label>
              <Select
                value={regionId}
                onValueChange={(v: string) => setRegionId(v)}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_REGIONS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Zoom detail</Label>
              <Tabs
                value={zoomKey}
                onValueChange={(v: string) => setZoomKey(v as ZoomPresetKey)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  {PRESET_KEYS.map((k) => (
                    <TabsTrigger key={k} value={k} disabled={busy}>
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="text-xs text-muted-foreground mt-1">
                {zoom.label} · Z{zoom.min}–Z{zoom.max}
              </div>
            </div>

            <div className="text-sm p-3 rounded border bg-muted/40">
              <div className="font-medium">Estimate</div>
              <div className="text-muted-foreground">
                ~{estimate.tileCount.toLocaleString()} tiles ·{' '}
                ~{formatBytes(estimate.bytes)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Downloads resume where they left off if interrupted.
              </div>
            </div>

            {phase.kind === 'resolving' && (
              <div className="text-sm text-muted-foreground">Resolving current build URL…</div>
            )}

            {phase.kind === 'downloading' && (
              <div className="space-y-2">
                <Progress value={pct} />
                <div className="text-xs text-muted-foreground">
                  {phase.progress.loaded.toLocaleString()} downloaded ·{' '}
                  {phase.progress.skipped.toLocaleString()} cached ·{' '}
                  {phase.progress.errors > 0
                    ? `${phase.progress.errors} errors · `
                    : ''}
                  {formatBytes(phase.progress.bytes)} new data
                </div>
              </div>
            )}

            {phase.kind === 'done' && (
              <div className="text-sm text-green-600">
                ✓ Downloaded {phase.progress.loaded.toLocaleString()} tiles{' '}
                ({formatBytes(phase.progress.bytes)}).
                {phase.progress.skipped > 0
                  ? ` Skipped ${phase.progress.skipped.toLocaleString()} already cached.`
                  : ''}
              </div>
            )}

            {phase.kind === 'error' && (
              <div className="text-sm text-red-600">Failed: {phase.error}</div>
            )}
          </div>

          <DialogFooter>
            {phase.kind === 'done' ? (
              <Button onClick={onClose}>Close</Button>
            ) : phase.kind === 'downloading' || phase.kind === 'resolving' ? (
              <Button disabled>Downloading…</Button>
            ) : phase.kind === 'error' ? (
              <>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => void start()}>Retry</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => void start()}>Download</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return RegionPicker;
}
