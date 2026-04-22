import type { FC } from 'react';
import type { SharedDependencies, WindsEntryRow } from '../../types';
import { createWindsEntry } from '../winds-entry';

export function createWindsOverrideDialog(Shared: SharedDependencies) {
  const { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } = Shared;
  const WindsEntry = createWindsEntry(Shared);

  const WindsOverrideDialog: FC<{
    open: boolean;
    onClose: () => void;
    winds: WindsEntryRow[];
    onChange: (next: WindsEntryRow[]) => void;
  }> = ({ open, onClose, winds, onChange }) => (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        <DialogHeader>
          <DialogTitle>Override winds aloft</DialogTitle>
          <DialogDescription>
            Entries here replace the default wind model per altitude. Planned
            headings and fuel recompute automatically. Leave empty to use
            zero-wind assumptions (winds-aloft auto-population lands in v0.4.2).
          </DialogDescription>
        </DialogHeader>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 2px' }}>
          <WindsEntry winds={winds} onChange={onChange} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
          <Button variant="ghost" onClick={() => onChange([])} disabled={winds.length === 0}>
            Clear all
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return WindsOverrideDialog;
}
