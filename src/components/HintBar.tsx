import { usePlannerStore } from '../state/store';
import { toolMetaById } from '../toolMeta';

export function HintBar() {
  const tool = usePlannerStore((s) => s.tool);
  const hint = toolMetaById[tool].hint;

  return (
    <div className="panel rounded-full px-4 py-1.5 text-xs text-slate-300">
      <span className="font-semibold text-white">{toolMetaById[tool].label}</span>
      <span className="mx-2 text-slate-600">·</span>
      {hint}
    </div>
  );
}
