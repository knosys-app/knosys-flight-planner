import type { FC } from 'react';
import type { SharedDependencies } from '../types';
import {
  deleteAirportsDb,
  downloadAirportsDb,
  getAirportsDbSize,
  isAirportsDbInstalled,
  type DownloadProgress,
} from '../data/first-run-download';
import { resetAeroDataSource } from '../hooks/use-aero-data';
import { getSettings, saveSettings } from '../store/settings-store';

export function createFirstRunModal(Shared: SharedDependencies) {
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
  } = Shared;

  type Status =
    | { kind: 'idle' }
    | { kind: 'downloading'; loaded: number; total: number | null }
    | { kind: 'installed'; sizeBytes: number; installedAt?: string }
    | { kind: 'error'; error: string };

  const FirstRunModal: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    const refreshStatus = async () => {
      const installed = await isAirportsDbInstalled();
      if (!installed) {
        setStatus({ kind: 'idle' });
        return;
      }
      const [size, settings] = await Promise.all([getAirportsDbSize(), getSettings()]);
      setStatus({
        kind: 'installed',
        sizeBytes: size ?? 0,
        installedAt: settings.airportsDbInstalledAt,
      });
    };

    useEffect(() => {
      if (!open) return;
      let cancelled = false;
      (async () => {
        if (cancelled) return;
        await refreshStatus();
      })();
      return () => {
        cancelled = true;
      };
    }, [open]);

    const startDownload = async () => {
      setStatus({ kind: 'downloading', loaded: 0, total: null });
      try {
        await downloadAirportsDb((p: DownloadProgress) =>
          setStatus({ kind: 'downloading', loaded: p.loaded, total: p.total }),
        );
        const installedAt = new Date().toISOString();
        await saveSettings({ airportsDbInstalledAt: installedAt });
        resetAeroDataSource();
        const size = await getAirportsDbSize();
        setStatus({ kind: 'installed', sizeBytes: size ?? 0, installedAt });
      } catch (err) {
        setStatus({ kind: 'error', error: String((err as Error).message ?? err) });
      }
    };

    const reinstall = async () => {
      try {
        await deleteAirportsDb();
        resetAeroDataSource();
      } catch {
        /* non-fatal */
      }
      await startDownload();
    };

    const pct = (() => {
      if (status.kind !== 'downloading' || !status.total) return undefined;
      return Math.round((status.loaded / status.total) * 100);
    })();

    return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Airport database</DialogTitle>
            <DialogDescription>
              A ~18 MB airport / navaid / runway / frequency database from OurAirports.
              Stored inside the browser (OPFS) and available offline.
            </DialogDescription>
          </DialogHeader>

          {status.kind === 'idle' && (
            <div className="text-sm text-muted-foreground">
              Not installed. Download now to enable airport search and navlog.
            </div>
          )}

          {status.kind === 'downloading' && (
            <div className="space-y-2">
              <Progress value={pct ?? 0} />
              <div className="text-xs text-muted-foreground">
                Downloaded {(status.loaded / 1_000_000).toFixed(1)} MB
                {status.total ? ` of ${(status.total / 1_000_000).toFixed(1)} MB` : ''}
              </div>
            </div>
          )}

          {status.kind === 'installed' && (
            <div className="text-sm space-y-1">
              <div className="text-green-600">✓ Installed</div>
              <div className="text-xs text-muted-foreground">
                Size: {(status.sizeBytes / 1_000_000).toFixed(1)} MB
                {status.installedAt
                  ? ` · Installed ${new Date(status.installedAt).toLocaleString()}`
                  : ''}
              </div>
            </div>
          )}

          {status.kind === 'error' && (
            <div className="text-sm text-red-600">Failed: {status.error}</div>
          )}

          <DialogFooter>
            {status.kind === 'downloading' ? (
              <Button disabled>Downloading…</Button>
            ) : status.kind === 'installed' ? (
              <>
                <Button variant="outline" onClick={() => void reinstall()}>
                  Re-download
                </Button>
                <Button onClick={onClose}>Close</Button>
              </>
            ) : status.kind === 'error' ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={() => void startDownload()}>Retry</Button>
              </>
            ) : (
              <Button onClick={() => void startDownload()}>Download database</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return FirstRunModal;
}
