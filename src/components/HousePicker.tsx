import clsx from 'clsx';
import { Box, Home } from 'lucide-react';
import { usePlannerStore } from '../state/store';
import { HOUSE_MODELS, hasAnyHouseModelAsset } from '../houseModels';
import { Panel, PanelTitle } from './ui';

/**
 * Choose which cottage the House tool places. Until the GLBs are dropped into
 * `public/models/`, every entry draws a correctly-sized placeholder box, so the
 * footprints on the plan are already true to the finished buildings.
 */
export function HousePicker() {
  const houseModelId = usePlannerStore((s) => s.houseModelId);
  const setHouseModel = usePlannerStore((s) => s.setHouseModel);
  const anyAssets = hasAnyHouseModelAsset();

  return (
    <Panel className="w-full">
      <PanelTitle>House model</PanelTitle>
      {/* A scrolling strip on phones so it does not bury the map; a list on desktop. */}
      <div className="flex gap-1 overflow-x-auto px-1.5 pb-1.5 md:flex-col md:gap-0.5 md:overflow-visible">
        {HOUSE_MODELS.map((model) => {
          const active = model.id === houseModelId;
          const [width, depth, height] = model.size;
          return (
            <button
              key={model.id}
              onClick={() => setHouseModel(model.id)}
              aria-pressed={active}
              title={model.description}
              className={clsx(
                'flex w-36 shrink-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition md:w-full',
                active ? 'bg-sky-500/15 text-white' : 'text-slate-300 hover:bg-white/5',
              )}
            >
              <span
                className={clsx(
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md',
                  active ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400',
                )}
              >
                {model.url ? <Home size={12} /> : <Box size={12} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{model.label}</span>
                <span className="block font-mono text-[10px] text-slate-500">
                  {width}×{depth} m · {height} m tall
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!anyAssets && (
        <p className="hidden border-t border-white/10 px-3 py-2 text-[10px] leading-relaxed text-slate-500 md:block">
          No GLBs loaded yet — these place as sized placeholders. Drop files into
          <code className="mx-1 text-slate-400">public/models/</code>
          and set each model's <code className="text-slate-400">url</code> in
          <code className="mx-1 text-slate-400">src/houseModels.ts</code>.
        </p>
      )}
    </Panel>
  );
}
