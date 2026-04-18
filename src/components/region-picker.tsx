import type { FC } from 'react';
import type { SharedDependencies } from '../types';
import { PMTILES_REGIONS } from '../constants';
import { downloadRegion } from '../map/pmtiles-storage';
import {
  addInstalledRegion,
  listInstalledRegions,
  removeInstalledRegion,
} from '../store/settings-store';
import { detachRegion } from '../map/pmtiles-protocol';
import { deleteRegion as deletePmtile } from '../map/pmtiles-storage';

export function createRegionPicker(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Button,
    Progress,
    Badge,
  } = Shared;

  const RegionPicker: FC<{
    open: boolean;
    onClose: () => void;
    onRegionAdded?: () => void;
  }> = ({ open, onClose, onRegionAdded }) => {
    const [installed, setInstalled] = useState<string[]>([]);
    const [progress, setProgress] = useState<Record<string, { loaded: number; total: number | null } | 'done' | 'error'>>({});

    const refresh = async () => {
      const regions = await listInstalledRegions();
      setInstalled(regions.map((r) => r.id));
    };

    useEffect(() => {
      if (open) void refresh();
    }, [open]);

    const download = async (regionId: string) => {
      const region = PMTILES_REGIONS.find((r) => r.id === regionId);
      if (!region) return;
      setProgress((p) => ({ ...p, [regionId]: { loaded: 0, total: null } }));
      try {
        const { sizeBytes } = await downloadRegion(regionId, region.url, (prog) => {
          setProgress((p) => ({ ...p, [regionId]: prog }));
        });
        await addInstalledRegion({
          id: regionId,
          name: region.name,
          url: region.url,
          sizeBytes,
          installedAt: new Date().toISOString(),
        });
        setProgress((p) => ({ ...p, [regionId]: 'done' }));
        await refresh();
        onRegionAdded?.();
      } catch (err) {
        setProgress((p) => ({ ...p, [regionId]: 'error' }));
      }
    };

    const uninstall = async (regionId: string) => {
      detachRegion(regionId);
      await deletePmtile(regionId);
      await removeInstalledRegion(regionId);
      setProgress((p) => {
        const { [regionId]: _omit, ...rest } = p;
        return rest;
      });
      await refresh();
    };

    return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Map regions</DialogTitle>
            <DialogDescription>
              Downloaded regions are stored in browser-scoped persistent storage (OPFS) and
              remain available offline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 flex-1 min-h-0 overflow-auto -mx-1 px-1">
            {PMTILES_REGIONS.map((region) => {
              const isInstalled = installed.includes(region.id);
              const prog = progress[region.id];
              const downloading = prog && typeof prog === 'object';
              const pct =
                downloading && prog.total
                  ? Math.round((prog.loaded / prog.total) * 100)
                  : undefined;

              return (
                <div key={region.id} className="border rounded p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{region.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ~{region.sizeMb} MB · {region.note}
                      </div>
                    </div>
                    {isInstalled && <Badge variant="secondary">Installed</Badge>}
                  </div>
                  {downloading && (
                    <div className="mt-2 space-y-1">
                      <Progress value={pct ?? 0} />
                      <div className="text-xs text-muted-foreground">
                        {(prog.loaded / 1_000_000).toFixed(1)} MB
                        {prog.total ? ` / ${(prog.total / 1_000_000).toFixed(1)} MB` : ''}
                      </div>
                    </div>
                  )}
                  {prog === 'error' && (
                    <div className="mt-2 text-xs text-red-600">
                      Download failed — check your connection and try again.
                    </div>
                  )}
                  <div className="mt-2 flex gap-2 justify-end">
                    {isInstalled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void uninstall(region.id)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => void download(region.id)}
                        disabled={!!downloading}
                      >
                        {downloading ? 'Downloading…' : 'Download'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return RegionPicker;
}
