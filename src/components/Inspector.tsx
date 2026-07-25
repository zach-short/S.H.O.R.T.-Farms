import { selectSelectedFeature, usePlannerStore } from '../state/store';
import { specByKind } from '../featureCatalog';
import { FeatureEditor } from './FeatureEditor';
import { Panel, PanelTitle } from './ui';

export function Inspector() {
  const feature = usePlannerStore(selectSelectedFeature);
  if (!feature) return null;

  return (
    <Panel className="w-full">
      <PanelTitle>{specByKind[feature.kind].label}</PanelTitle>
      <div className="px-3 pt-1 pb-3">
        <FeatureEditor feature={feature} />
      </div>
    </Panel>
  );
}
