import { Crosshair } from 'lucide-react';
import { usePlannerStore } from '../state/store';
import type { SceneCapabilities } from '../cesium/viewer';
import { Button, Panel, PanelTitle, Toggle } from './ui';

export function LayersPanel({
  onFlyHome,
  capabilities,
}: {
  onFlyHome: () => void;
  capabilities: SceneCapabilities;
}) {
  const showPhotorealistic = usePlannerStore((s) => s.showPhotorealistic);
  const showBoundary = usePlannerStore((s) => s.showBoundary);
  const toggleLayer = usePlannerStore((s) => s.toggleLayer);

  const canToggleBase = capabilities.photorealistic && (capabilities.terrain || capabilities.imagery);

  return (
    <Panel className="w-full pb-2">
      <PanelTitle>Layers</PanelTitle>
      <Toggle
        label="Photorealistic 3D"
        checked={showPhotorealistic}
        disabled={!canToggleBase}
        onChange={() => toggleLayer('showPhotorealistic')}
      />
      {!canToggleBase && (
        <p className="px-3 pb-1 text-[10px] leading-relaxed text-slate-500">
          Your ion token only grants the Photorealistic 3D Tiles asset, so there is no
          terrain or imagery layer to switch to.
        </p>
      )}
      <Toggle
        label="Parcel boundary"
        checked={showBoundary}
        onChange={() => toggleLayer('showBoundary')}
      />
      <div className="px-2 pt-1">
        <Button className="w-full justify-start" onClick={onFlyHome}>
          <Crosshair size={13} /> Recenter on parcel
        </Button>
      </div>
    </Panel>
  );
}
