import type { FC } from 'react';
import type { SharedDependencies } from '../types';
import {
  downloadAirportsDb,
  isAirportsDbInstalled,
  type DownloadProgress,
} from '../data/first-run-download';
import { saveSettings } from '../store/settings-store';

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

  const FirstRunModal: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const [status, setStatus] = useState<
      | { kind: 'idle' }
      | { kind: 'downloading'; loaded: number; total: number | null }
      | { kind: 'installed' }
      | { kind: 'error'; error: string }
    >({ kind: 'idle' });

    useEffect(() => {
      if (!open) return;
      let cancelled = false;
      (async () => {
        const installed = await isAirportsDbInstalled();
        if (!cancelled && installed) setStatus({ kind: 'installed' });
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
        await saveSettings({ airportsDbInstalledAt: new Date().toISOString() });
        setStatus({ kind: 'installed' });
      } catch (err) {
        setStatus({ kind: 'error', error: String((err as Error).message ?? err) });
      }
    };

    const pct = (() => {
      if (status.kind !== 'downloading' || !status.total) return undefined;
      return Math.round((status.loaded / status.total) * 100);
    })();

    return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install airport database</DialogTitle>
            <DialogDescription>
              The plugin needs a ~15 MB airport / navaid database to work offline. It will be
              downloaded once and stored inside the browser (OPFS).
            </DialogDescription>
          </DialogHeader>

          {status.kind === 'idle' && (
            <div className="text-sm text-muted-foreground">Click below to start the download.</div>
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
            <div className="text-sm text-green-600">\u2713 Airport database ready.</div>
          )}

          {status.kind === 'error' && (
            <div className="text-sm text-red-600">Failed: {status.error}</div>
          )}

          <DialogFooter>
            {status.kind === 'installed' ? (
              <Button onClick={onClose}>Continue</Button>
            ) : status.kind === 'downloading' ? (
              <Button disabled>Downloading\u2026</Button>
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
