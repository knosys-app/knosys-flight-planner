import type { FC } from 'react';
import type { SharedDependencies } from '../../types';
import {
  downloadAirportsDb,
  getAirportsDbSize,
  isAirportsDbInstalled,
  type DownloadProgress,
} from '../../data/first-run-download';
import { resetAeroDataSource } from '../../hooks/use-aero-data';
import { saveSettings } from '../../store/settings-store';

/**
 * Soft onboarding rail card — replaces the v0.2 blocking first-run
 * modal. The plugin is usable the moment it mounts; this card nudges
 * the user toward downloading the airport/navaid database, but never
 * prevents them from working. Dismissed state is remembered across
 * sessions.
 */

const DISMISS_KEY = 'kfp-setup-card-dismissed';

type Status =
  | { kind: 'idle' }
  | { kind: 'downloading'; loaded: number; total: number | null }
  | { kind: 'installed' }
  | { kind: 'error'; error: string };

export function createSetupCard(Shared: SharedDependencies) {
  const { useState, useEffect, Progress, lucideIcons } = Shared;
  const { Database, X, Check, AlertCircle, Download } = lucideIcons as Record<
    string,
    any
  >;

  const SetupCard: FC<{}> = () => {
    const [installed, setInstalled] = useState<boolean | null>(null);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const [dismissed, setDismissed] = useState<boolean>(() => {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(DISMISS_KEY) === '1';
    });

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const ok = await isAirportsDbInstalled();
          if (!cancelled) {
            setInstalled(ok);
            if (ok) setStatus({ kind: 'installed' });
          }
        } catch {
          if (!cancelled) setInstalled(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    const startDownload = async () => {
      setStatus({ kind: 'downloading', loaded: 0, total: null });
      try {
        await downloadAirportsDb((p: DownloadProgress) =>
          setStatus({ kind: 'downloading', loaded: p.loaded, total: p.total }),
        );
        const installedAt = new Date().toISOString();
        await saveSettings({ airportsDbInstalledAt: installedAt });
        resetAeroDataSource();
        await getAirportsDbSize();
        setStatus({ kind: 'installed' });
        setInstalled(true);
      } catch (err) {
        setStatus({ kind: 'error', error: String((err as Error).message ?? err) });
      }
    };

    const dismiss = () => {
      setDismissed(true);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DISMISS_KEY, '1');
      }
    };

    // Installed + dismissed → don't render at all.
    if (installed === true) return null;
    if (dismissed && status.kind !== 'downloading' && status.kind !== 'error') {
      return null;
    }
    if (installed === null) return null; // Still probing — avoid flash.

    const pct =
      status.kind === 'downloading' && status.total
        ? Math.round((status.loaded / status.total) * 100)
        : null;

    return (
      <div className="kfp-setup-card">
        <div className="kfp-setup-card-icon">
          {status.kind === 'error'
            ? AlertCircle && <AlertCircle className="w-4 h-4" />
            : status.kind === 'installed'
              ? Check && <Check className="w-4 h-4" />
              : Database && <Database className="w-4 h-4" />}
        </div>
        <div className="kfp-setup-card-body">
          {status.kind === 'idle' && (
            <>
              <div className="kfp-setup-card-title">Set up airport data</div>
              <div className="kfp-setup-card-sub">
                Download the offline airport, navaid, and runway database
                (~18 MB). Enables search and navlog anywhere.
              </div>
              <div className="kfp-setup-card-actions">
                <button
                  type="button"
                  className="kfp-setup-card-primary"
                  onClick={() => void startDownload()}
                >
                  {Download && <Download className="w-3.5 h-3.5" />}
                  Download · ~18 MB
                </button>
                <button
                  type="button"
                  className="kfp-setup-card-secondary"
                  onClick={dismiss}
                >
                  Later
                </button>
              </div>
            </>
          )}

          {status.kind === 'downloading' && (
            <>
              <div className="kfp-setup-card-title">Downloading airport data…</div>
              <div className="kfp-setup-card-progress">
                <Progress value={pct ?? 0} />
              </div>
              <div className="kfp-setup-card-sub">
                {(status.loaded / 1_000_000).toFixed(1)} MB
                {status.total
                  ? ` of ${(status.total / 1_000_000).toFixed(1)} MB`
                  : ''}
              </div>
            </>
          )}

          {status.kind === 'error' && (
            <>
              <div className="kfp-setup-card-title">Download failed</div>
              <div className="kfp-setup-card-sub">{status.error}</div>
              <div className="kfp-setup-card-actions">
                <button
                  type="button"
                  className="kfp-setup-card-primary"
                  onClick={() => void startDownload()}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="kfp-setup-card-secondary"
                  onClick={dismiss}
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>

        {status.kind !== 'downloading' && (
          <button
            type="button"
            aria-label="Dismiss setup card"
            className="kfp-setup-card-close"
            onClick={dismiss}
          >
            {X && <X className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    );
  };

  return SetupCard;
}
