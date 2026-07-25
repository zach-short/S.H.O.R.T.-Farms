import clsx from 'clsx';
import {
  Anchor,
  Flower2,
  Home,
  MousePointer2,
  PlaneTakeoff,
  Route,
  Waypoints,
  Trees,
  UtensilsCrossed,
  Waves,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { usePlannerStore } from '../state/store';
import { TOOL_META } from '../toolMeta';
import { specByKind } from '../featureCatalog';
import type { FeatureKind, ToolId } from '../types';
import { Panel } from './ui';

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

const icons: Record<ToolId, IconType> = {
  select: MousePointer2,
  house: Home,
  restaurant: UtensilsCrossed,
  marina: Anchor,
  road: Route,
  river: Waypoints,
  airstrip: PlaneTakeoff,
  pond: Waves,
  garden: Flower2,
  tree: Trees,
};

const groupOf = (id: ToolId) =>
  id === 'select' ? 'select' : specByKind[id as FeatureKind].group;

export function Toolbar() {
  const tool = usePlannerStore((s) => s.tool);
  const setTool = usePlannerStore((s) => s.setTool);

  return (
    // A row along the bottom on phones, a column down the left on desktop.
    <Panel className="flex flex-row gap-1 overflow-x-auto p-1.5 md:flex-col md:overflow-visible">
      {TOOL_META.map((entry, index) => {
        const Icon = icons[entry.id];
        const active = tool === entry.id;
        const newGroup = index > 0 && groupOf(entry.id) !== groupOf(TOOL_META[index - 1].id);

        return (
          <div key={entry.id} className="contents">
            {newGroup && (
              <div className="w-px shrink-0 self-stretch bg-white/10 md:mx-2 md:my-0.5 md:h-px md:w-auto" />
            )}
            <button
              onClick={() => setTool(entry.id)}
              title={`${entry.label} (${entry.shortcut})`}
              aria-pressed={active}
              className={clsx(
                'group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition',
                active
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={18} strokeWidth={2} />
              <span
                className={clsx(
                  'absolute right-1 bottom-0.5 text-[9px] font-semibold',
                  active ? 'text-white/80' : 'text-slate-500',
                )}
              >
                {entry.shortcut}
              </span>
            </button>
          </div>
        );
      })}
    </Panel>
  );
}
