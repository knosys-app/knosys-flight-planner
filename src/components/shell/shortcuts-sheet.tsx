import type { FC } from 'react';
import type { SharedDependencies } from '../../types';

/**
 * Keyboard-shortcut reference. Opens on ⌘/ (Ctrl+/ on Windows/Linux),
 * closes on Esc. Listed shortcuts match what the shell actually binds.
 */
export function createShortcutsSheet(Shared: SharedDependencies) {
  const { useState, useEffect, Dialog, DialogContent } = Shared;

  const GROUPS: Array<{
    heading: string;
    items: Array<{ keys: string[]; label: string }>;
  }> = [
    {
      heading: 'Sheet',
      items: [
        { keys: ['⌘', '↑'], label: 'Expand bottom sheet' },
        { keys: ['⌘', '↓'], label: 'Collapse bottom sheet' },
      ],
    },
    {
      heading: 'Timeline scrub',
      items: [
        { keys: ['←'], label: 'Scrub backward' },
        { keys: ['→'], label: 'Scrub forward' },
        { keys: ['Home'], label: 'Jump to start' },
        { keys: ['End'], label: 'Jump to end' },
        { keys: ['Esc'], label: 'Clear scrub' },
      ],
    },
    {
      heading: 'Help',
      items: [
        { keys: ['⌘', '/'], label: 'Open this sheet' },
        { keys: ['Esc'], label: 'Close this sheet' },
      ],
    },
  ];

  const ShortcutsSheet: FC<{}> = () => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const meta = e.metaKey || e.ctrlKey;
        if (meta && e.key === '/') {
          e.preventDefault();
          setOpen((v) => !v);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="kfp-scope"
          style={{
            maxWidth: 520,
            padding: 0,
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          <div className="kfp-shortcuts">
            <div className="kfp-shortcuts-head">
              <div className="kfp-shortcuts-title">Keyboard shortcuts</div>
              <div className="kfp-shortcuts-sub">Press ⌘/ anytime to reopen.</div>
            </div>

            <div className="kfp-shortcuts-groups">
              {GROUPS.map((g) => (
                <div key={g.heading} className="kfp-shortcuts-group">
                  <div className="kfp-shortcuts-group-head">{g.heading}</div>
                  {g.items.map((item, i) => (
                    <div key={i} className="kfp-shortcuts-row">
                      <span>{item.label}</span>
                      <span className="kfp-shortcuts-keys">
                        {item.keys.map((k, j) => (
                          <kbd key={j} className="kfp-kbd">
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return ShortcutsSheet;
}
