import { Trash2 } from 'lucide-react';
import { usePlannerStore } from '../state/store';
import { formatArea, formatLength, formatLonLat, pathLength, polygonArea } from '../lib/geo';
import { outlineOf, smoothingOf } from '../lib/shape';
import { isStructure, specByKind } from '../featureCatalog';
import { HOUSE_MODELS, resolveHouseModel } from '../houseModels';
import type { PlacedFeature } from '../types';
import { Button, TextInput } from './ui';

function Readout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-950/50 px-2.5 py-2">
      <div className="text-[10px] tracking-wider text-slate-500 uppercase">{title}</div>
      <div className="mt-1 font-mono text-[11px] leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

/**
 * A slider whose whole drag counts as one undo step: `tag` groups the stream of
 * updates, and letting go closes the group.
 */
function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  tag,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  tag: string;
  onChange: (value: number, tag: string) => void;
}) {
  const endGroup = usePlannerStore((s) => s.endHistoryGroup);
  return (
    <div>
      <label className="mb-1 block text-[11px] text-slate-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value), tag)}
          onPointerUp={endGroup}
          onKeyUp={endGroup}
          onBlur={endGroup}
          className="h-1 flex-1 accent-sky-500"
        />
        <span className="w-11 text-right font-mono text-[11px] text-slate-400">{display}</span>
      </div>
    </div>
  );
}

/**
 * Every editable property of one placed feature. Shared by the map-side
 * inspector and the components browser so both offer the same controls.
 */
export function FeatureEditor({ feature }: { feature: PlacedFeature }) {
  const updateFeature = usePlannerStore((s) => s.updateFeature);
  const removeFeature = usePlannerStore((s) => s.removeFeature);
  const endHistoryGroup = usePlannerStore((s) => s.endHistoryGroup);

  const spec = specByKind[feature.kind];
  const { geometry } = feature;
  const drawn = geometry.type !== 'point';
  const outline = outlineOf(feature);

  const setProp = (patch: Record<string, unknown>, tag: string) =>
    updateFeature(feature.id, { props: { ...feature.props, ...patch } }, tag);

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] text-slate-400">Name</label>
        <TextInput
          value={feature.name}
          onChange={(e) => updateFeature(feature.id, { name: e.target.value }, `name:${feature.id}`)}
          onBlur={endHistoryGroup}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
          }}
          spellCheck={false}
        />
      </div>

      {feature.kind === 'house' && (
        <div>
          <label className="mb-1 block text-[11px] text-slate-400">Model</label>
          <select
            value={resolveHouseModel(feature.props.modelId).id}
            onChange={(e) => setProp({ modelId: e.target.value }, `model:${feature.id}`)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 focus:border-sky-400/60 focus:outline-none"
          >
            {HOUSE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} — {model.size[0]}×{model.size[1]} m
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Only the boxed structures have a meaningful facing direction. */}
      {isStructure(feature.kind) && (
        <Slider
          label="Heading"
          value={feature.props.heading ?? 0}
          display={`${feature.props.heading ?? 0}°`}
          min={0}
          max={359}
          tag={`heading:${feature.id}`}
          onChange={(heading, tag) => setProp({ heading }, tag)}
        />
      )}

      {spec.mode === 'polyline' && (
        <Slider
          label="Width"
          value={feature.props.width ?? 6}
          display={`${feature.props.width ?? 6} m`}
          min={2}
          max={60}
          tag={`width:${feature.id}`}
          onChange={(width, tag) => setProp({ width }, tag)}
        />
      )}

      {drawn && (
        <div>
          <Slider
            label="Smoothing"
            value={Math.round(smoothingOf(feature) * 100)}
            display={`${Math.round(smoothingOf(feature) * 100)}%`}
            min={0}
            max={100}
            tag={`smoothing:${feature.id}`}
            onChange={(percent, tag) => setProp({ smoothing: percent / 100 }, tag)}
          />
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Rounds the corners between your points. The points themselves stay put — drag the
            white handles on the map to reshape, or a small handle to add one.
          </p>
        </div>
      )}

      {geometry.type === 'point' && (
        <Readout title="Location">
          {formatLonLat(geometry.position)}
          <div className="text-slate-500">{geometry.position[2].toFixed(1)} m ellipsoid height</div>
        </Readout>
      )}

      {geometry.type === 'polyline' && (
        <Readout title="Length">
          {formatLength(pathLength(outline))}
          <div className="text-slate-500">{geometry.positions.length} points</div>
        </Readout>
      )}

      {geometry.type === 'polygon' && (
        <Readout title="Area">
          {formatArea(polygonArea(outline))}
          <div className="text-slate-500">
            {formatLength(pathLength([...outline, outline[0]]))} perimeter ·{' '}
            {geometry.positions.length} points
          </div>
        </Readout>
      )}

      <Button variant="danger" className="w-full" onClick={() => removeFeature(feature.id)}>
        <Trash2 size={13} /> Delete
        <kbd className="ml-1 rounded bg-white/10 px-1 text-[10px]">Del</kbd>
      </Button>
    </div>
  );
}
