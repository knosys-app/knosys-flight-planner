import type { FC } from 'react';
import type { SharedDependencies } from '../../types';
import {
  downloadAirportsDb,
  getAirportsDbSize,
  isAirportsDbInstalled,
  type DownloadProgress,
} from '../../data/first-run-download';
import { resetAeroDataSource } from '../../hooks/use-aero-data';
import { getSettings, saveSettings } from '../../store/settings-store';
import { CURRENT_AIRPORTS_DB_VERSION } from '../../constants';

/**
 * Soft onboarding rail card — replaces the v0.2 blocking first-run
 * modal. The plugin is usable the moment it mounts; this card nudges
 * the user toward downloading the airport/navaid database, but never
 * prevents them from working. Dismissed state is remembered across
 * sessions.
 *
 * Also handles DB schema upgrades: when the installed airport DB is
 * older than `CURRENT_AIRPORTS_DB_VERSION` (v2 added runway-endpoint
 * columns in v0.9), the card re-surfaces with an "update available"
 * state. Dismissal is tracked per-version so each schema bump gets
 * its own prompt.
 */

const DISMISS_KEY_PREFIX = 'kfp-setup-card-dismissed-v';

function dismissKey(version: string): string {
  return `${DISMISS_KEY_PREFIX}${version}`;
}

type CardMode = 'first-install' | 'upgrade-available' | null;

type Status =
  | { kind: 'idle' }
  | { kind: 'downloading'; loaded: number; total: number | null }
  | { kind: 'installed' }
  | { kind: 'error'; error: string };

export function createSetupCard(Shared: SharedDependencies) {
  const { useState, useEffect, Progress, lucideIcons } = Shared;
  const { Database, X, Check, AlertCircle, Download, ArrowUpCircle } =
    lucideIcons as Record<string, any>;

  const SetupCard: FC<{}> = () => {
    const [mode, setMode] = useState<CardMode | 'probing'>('probing');
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const [dismissed, setDismissed] = useState<boolean>(false);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const [installed, settings] = await Promise.all([
            isAirportsDbInstalled(),
            getSettings(),
          ]);
          if (cancelled) return;
          if (!installed) {
            setMode('first-install');
            setDismissed(readDismissed('first-install'));
            return;
          }
          const installedVersion = settings.airportsDbVersion;
          if (installedVersion !== CURRENT_AIRPORTS_DB_VERSION) {
            setMode('upgrade-available');
            setDismissed(readDismissed(`upgrade-${CURRENT_AIRPORTS_DB_VERSION}`));
            return;
          }
          setMode(null);
          setStatus({ kind: 'installed' });
        } catch {
          if (!cancelled) setMode('first-install');
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
        await saveSettings({
          airportsDbInstalledAt: installedAt,
          airportsDbVersion: CURRENT_AIRPORTS_DB_VERSION,
        });
        resetAeroDataSource();
        await getAirportsDbSize();
        setStatus({ kind: 'installed' });
        setMode(null);
      } catch (err) {
        setStatus({ kind: 'error', error: String((err as Error).message ?? err) });
      }
    };

    const dismiss = () => {
      setDismissed(true);
      if (mode === 'first-install') writeDismissed('first-install');
      else if (mode === 'upgrade-available')
        writeDismissed(`upgrade-${CURRENT_AIRPORTS_DB_VERSION}`);
    };

    if (mode === 'probing' || mode === null) return null;
    if (dismissed && status.kind !== 'downloading' && status.kind !== 'error') {
      return null;
    }

    const pct =
      status.kind === 'downloading' && status.total
        ? Math.round((status.loaded / status.total) * 100)
        : null;

    const isUpgrade = mode === 'upgrade-available';

    return (
      <div className="kfp-setup-card">
        <div className="kfp-setup-card-icon">
          {status.kind === 'error'
            ? AlertCircle && <AlertCircle className="w-4 h-4" />
            : status.kind === 'installed'
              ? Check && <Check className="w-4 h-4" />
              : isUpgrade
                ? ArrowUpCircle && <ArrowUpCircle className="w-4 h-4" />
                : Database && <Database className="w-4 h-4" />}
        </div>
        <div className="kfp-setup-card-body">
          {status.kind === 'idle' && !isUpgrade && (
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

          {status.kind === 'idle' && isUpgrade && (
            <>
              <div className="kfp-setup-card-title">Database update available</div>
              <div className="kfp-setup-card-sub">
                Adds accurate runway positions, so parallel runways render
                where they actually are. Same download, one-time refresh.
              </div>
              <div className="kfp-setup-card-actions">
                <button
                  type="button"
                  className="kfp-setup-card-primary"
                  onClick={() => void startDownload()}
                >
                  {Download && <Download className="w-3.5 h-3.5" />}
                  Update · ~18 MB
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
              <div className="kfp-setup-card-title">
                {isUpgrade ? 'Updating airport data…' : 'Downloading airport data…'}
              </div>
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
              <div className="kfp-setup-card-title">
                {isUpgrade ? 'Update failed' : 'Download failed'}
              </div>
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

function readDismissed(variant: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(dismissKey(variant)) === '1';
}

function writeDismissed(variant: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(dismissKey(variant), '1');
}
