import { useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, X } from 'lucide-react';
import { selectFeatures, usePlannerStore } from '../state/store';
import { FEATURE_SPECS, specByKind } from '../featureCatalog';
import { formatArea, formatLength, formatLonLat, pathLength, polygonArea } from '../lib/geo';
import { outlineOf } from '../lib/shape';
import type { FeatureKind, PlacedFeature } from '../types';
import { FeatureEditor } from './FeatureEditor';
import { Button, Panel } from './ui';

type Tab = 'all' | FeatureKind;

/** One-line summary of what a feature covers, for the list row. */
function summary(feature: PlacedFeature) {
  const outline = outlineOf(feature);
  if (feature.geometry.type === 'point') return formatLonLat(outline[0]);
  if (feature.geometry.type === 'polyline') return formatLength(pathLength(outline));
  return formatArea(polygonArea(outline));
}

export function ComponentsPanel({
  onClose,
  onFly,
}: {
  onClose: () => void;
  onFly: (feature: PlacedFeature) => void;
}) {
  const features = usePlannerStore(selectFeatures);
  const selectedId = usePlannerStore((s) => s.selectedId);
  const setSelected = usePlannerStore((s) => s.setSelected);
  const setTool = usePlannerStore((s) => s.setTool);
  const [tab, setTab] = useState<Tab>('all');

  // Only kinds that are actually on the plan get a tab, so the row stays short.
  const kinds = FEATURE_SPECS.map((s) => s.kind).filter((kind) =>
    features.some((f) => f.kind === kind),
  );
  // The tab a feature was deleted out of falls back to All.
  const active: Tab = tab !== 'all' && !kinds.includes(tab) ? 'all' : tab;
  const listed = active === 'all' ? features : features.filter((f) => f.kind === active);
  const selected = features.find((f) => f.id === selectedId) ?? null;

  function open(feature: PlacedFeature) {
    // Selecting from here should also make the map ready to edit the thing.
    setTool('select');
    setSelected(feature.id);
    onFly(feature);
  }

  return (
    <Panel className="flex max-h-[70vh] w-full flex-col overflow-hidden md:max-h-[78vh] md:w-80">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
            Components
          </div>
          <div className="text-[11px] text-slate-500">
            {features.length} placed on this plan
          </div>
        </div>
        <Button onClick={onClose} title="Close" className="h-7 w-7 rounded-lg p-0">
          <X size={14} />
        </Button>
      </div>

      {features.length === 0 ? (
        <p className="px-3 py-4 text-xs leading-relaxed text-slate-400">
          Nothing placed yet. Pick a tool from the toolbar and click the map to start — whatever
          you add shows up here.
        </p>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5">
            {(['all', ...kinds] as Tab[]).map((kind) => {
              const isActive = kind === active;
              const count =
                kind === 'all' ? features.length : features.filter((f) => f.kind === kind).length;
              return (
                <button
                  key={kind}
                  onClick={() => setTab(kind)}
                  aria-pressed={isActive}
                  className={clsx(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition',
                    isActive
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {kind !== 'all' && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: specByKind[kind].color }}
                    />
                  )}
                  {kind === 'all' ? 'All' : specByKind[kind].label}
                  <span className={isActive ? 'text-white/70' : 'text-slate-500'}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {listed.map((feature) => {
              const isSelected = feature.id === selectedId;
              return (
                <button
                  key={feature.id}
                  onClick={() => open(feature)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition',
                    isSelected ? 'bg-sky-500/15' : 'hover:bg-white/5',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: specByKind[feature.kind].color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={clsx(
                        'block truncate text-xs font-medium',
                        isSelected ? 'text-sky-200' : 'text-slate-200',
                      )}
                    >
                      {feature.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-slate-500">
                      {summary(feature)}
                    </span>
                  </span>
                  <ChevronLeft
                    size={13}
                    className={clsx(
                      'shrink-0 -rotate-180',
                      isSelected ? 'text-sky-300' : 'text-slate-600',
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* Editing happens right here rather than sending the user elsewhere. */}
          {selected && (
            <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-white/10 px-3 py-2.5">
              <div className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                Editing · {specByKind[selected.kind].label}
              </div>
              <FeatureEditor feature={selected} />
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
