import { FEATURE_SPECS } from './featureCatalog';
import type { ToolId } from './types';

export interface ToolMeta {
  id: ToolId;
  label: string;
  shortcut: string;
  hint: string;
  cursor: string;
}

const SELECT_META: ToolMeta = {
  id: 'select',
  label: 'Select',
  shortcut: 'V',
  hint:
    'Click a feature to select it. Structures drag to move. On a drawn shape, ' +
    'drag a white point to reshape it, a small point to add one, Alt-click to remove one.',
  cursor: 'default',
};

// Every placement tool is generated from its feature spec, so adding a kind to
// the catalog is all it takes to get a toolbar button and a shortcut.
export const TOOL_META: ToolMeta[] = [
  SELECT_META,
  ...FEATURE_SPECS.map((spec) => ({
    id: spec.kind as ToolId,
    label: spec.label,
    shortcut: spec.shortcut,
    hint: spec.hint,
    cursor: 'crosshair',
  })),
];

export const toolMetaById = Object.fromEntries(TOOL_META.map((t) => [t.id, t])) as Record<
  ToolId,
  ToolMeta
>;
