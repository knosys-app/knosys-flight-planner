import type { FC } from 'react';
import type {
  AircraftProfile,
  NavlogRow,
  Plan,
  SharedDependencies,
} from '../../types';
import { listCodecs } from '../../codecs/codec-registry';
import { downloadText } from '../../utils/download-blob';

export interface PlanPillProps {
  plan: Plan;
  aircraft: AircraftProfile | null;
  navlog: NavlogRow[];
  onRename: (name: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSave: () => void;
}

/**
 * Floating plan title + quick menu. The menu also hosts Share (exports:
 * GPX, FPL, CSV — Print handled natively by the host via window.print).
 * Per v0.8 plan, the dedicated Export rail section is retired; everything
 * funnels through here.
 */
export function createPlanPill(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    Input,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    lucideIcons,
  } = Shared;
  const {
    MoreHorizontal,
    Save,
    FilePlus,
    Copy,
    Trash2,
    Share2,
    Printer,
    Download,
  } = lucideIcons as Record<string, any>;

  const PlanPill: FC<PlanPillProps> = ({
    plan,
    aircraft,
    navlog,
    onRename,
    onNew,
    onDuplicate,
    onDelete,
    onSave,
  }) => {
    const [value, setValue] = useState(plan.name);
    const [editing, setEditing] = useState(false);

    useEffect(() => {
      setValue(plan.name);
    }, [plan.id]);

    const commitEdit = () => {
      setEditing(false);
      if (value.trim() && value !== plan.name) onRename(value.trim());
    };

    const label = plan.departureIcao && plan.destinationIcao
      ? `${plan.departureIcao} → ${plan.destinationIcao}`
      : plan.departureIcao || plan.destinationIcao || '';

    const codecs = listCodecs();
    const safeName = (plan.name || 'plan').replace(/[^a-z0-9-_]+/gi, '_');
    const canExport = aircraft !== null;

    const exportCodec = (codecId: string) => {
      const codec = codecs.find((c) => c.id === codecId);
      if (!codec || !aircraft) return;
      const payload = codec.write(plan, aircraft, navlog);
      downloadText(`${safeName}${codec.extension}`, payload, codec.mime);
    };

    const print = () => {
      if (typeof window !== 'undefined') window.print();
    };

    return (
      <div className="kfp-pill kfp-surface-thick">
        {editing ? (
          <Input
            value={value}
            autoFocus
            onChange={(e: any) => setValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') {
                setValue(plan.name);
                setEditing(false);
              }
            }}
            style={{
              height: 28,
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: 15,
              fontWeight: 500,
              minWidth: 180,
              outline: 'none',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'text',
              color: 'inherit',
              font: 'inherit',
              letterSpacing: '-0.011em',
            }}
            title="Rename plan"
          >
            {plan.name || 'Untitled plan'}
          </button>
        )}

        {label && <span className="kfp-pill-chip">{label}</span>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Plan menu"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              {MoreHorizontal && <MoreHorizontal className="w-4 h-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="kfp-scope" style={{ minWidth: 220 }}>
            <DropdownMenuItem onSelect={() => onSave()}>
              {Save && <Save className="w-4 h-4 mr-2" />}
              Save plan
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNew()}>
              {FilePlus && <FilePlus className="w-4 h-4 mr-2" />}
              New plan
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate()}>
              {Copy && <Copy className="w-4 h-4 mr-2" />}
              Duplicate
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <div
              style={{
                padding: '6px 10px 4px',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'rgb(var(--kfp-fg-muted))',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {Share2 && <Share2 className="w-3 h-3" />}
              Share
            </div>
            {codecs.map((codec) => (
              <DropdownMenuItem
                key={codec.id}
                disabled={!canExport}
                onSelect={() => exportCodec(codec.id)}
              >
                {Download && <Download className="w-4 h-4 mr-2" />}
                {codec.name}
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--kfp-font-mono)',
                    fontSize: 10,
                    color: 'rgb(var(--kfp-fg-muted))',
                  }}
                >
                  {codec.extension}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => print()}>
              {Printer && <Printer className="w-4 h-4 mr-2" />}
              Print navlog
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete()}
              style={{ color: 'rgb(var(--kfp-danger))' }}
            >
              {Trash2 && <Trash2 className="w-4 h-4 mr-2" />}
              Delete plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return PlanPill;
}
