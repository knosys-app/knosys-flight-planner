import type { FC } from 'react';
import type { AircraftProfile, NavlogRow, Plan, SharedDependencies } from '../types';
import { listCodecs } from '../codecs/codec-registry';
import { downloadText } from '../utils/download-blob';

export function createExportBar(Shared: SharedDependencies) {
  const { Button, Label, lucideIcons } = Shared;
  const { Download } = lucideIcons as Record<string, any>;

  const ExportBar: FC<{
    plan: Plan;
    aircraft: AircraftProfile;
    navlog: NavlogRow[];
  }> = ({ plan, aircraft, navlog }) => {
    const codecs = listCodecs();
    const safeName = (plan.name || 'plan').replace(/[^a-z0-9-_]+/gi, '_');

    return (
      <div>
        <Label>Export</Label>
        <div className="flex gap-2 flex-wrap">
          {codecs.map((codec) => (
            <Button
              key={codec.id}
              variant="outline"
              size="sm"
              onClick={() => {
                const payload = codec.write(plan, aircraft, navlog);
                downloadText(`${safeName}${codec.extension}`, payload, codec.mime);
              }}
              title={`Export as ${codec.name}`}
            >
              {Download && <Download className="w-4 h-4 mr-1" />}
              {codec.name}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  return ExportBar;
}
