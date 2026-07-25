import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Layers, List, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from './components/ui';
import { usePlannerScene } from './cesium/usePlannerScene';
import { usePlannerStore } from './state/store';
import { ProjectBar } from './components/ProjectBar';
import { Toolbar } from './components/Toolbar';
import { HousePicker } from './components/HousePicker';
import { Inspector } from './components/Inspector';
import { ComponentsPanel } from './components/ComponentsPanel';
import { LayersPanel } from './components/LayersPanel';
import { HintBar } from './components/HintBar';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hydrated = usePlannerStore((s) => s.hydrated);
  const hydrate = usePlannerStore((s) => s.hydrate);
  const tool = usePlannerStore((s) => s.tool);
  const [layersOpen, setLayersOpen] = useState(false);
  const [componentsOpen, setComponentsOpen] = useState(false);
  const { status, flyHome, flyToFeature } = usePlannerScene(containerRef);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {(status.phase === 'loading' || !hydrated) && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-slate-950">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="animate-spin" size={22} />
            <span className="text-sm">Loading terrain and imagery…</span>
          </div>
        </div>
      )}

      {status.phase === 'error' && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-slate-950 p-8">
          <div className="panel max-w-md rounded-xl p-5">
            <div className="mb-2 flex items-center gap-2 text-rose-300">
              <TriangleAlert size={16} />
              <span className="text-sm font-semibold">Could not start the 3D scene</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{status.message}</p>
          </div>
        </div>
      )}

      {status.phase === 'ready' && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="pointer-events-auto absolute top-3 left-3 flex items-center gap-2 md:top-4 md:left-4">
              <ProjectBar />
              <Button
                variant="ghost"
                onClick={() => setComponentsOpen((v) => !v)}
                aria-pressed={componentsOpen}
                title="All components"
                className={clsx(
                  'panel h-10 w-10 shrink-0 rounded-xl',
                  componentsOpen && 'text-sky-300',
                )}
              >
                <List size={16} />
              </Button>
              {/* Phones get Layers behind a toggle; desktop keeps it pinned open. */}
              <Button
                variant="ghost"
                onClick={() => setLayersOpen((v) => !v)}
                aria-pressed={layersOpen}
                title="Layers"
                className="panel h-10 w-10 shrink-0 rounded-xl md:hidden"
              >
                <Layers size={16} />
              </Button>
            </div>

            {/*
              The components browser clears the toolbar on desktop and takes the
              width it needs on phones. It carries its own editor, so the
              floating inspector stands down while it is open.
            */}
            {componentsOpen && (
              <div className="pointer-events-auto absolute top-16 right-3 left-3 md:top-20 md:right-auto md:left-20">
                <ComponentsPanel
                  onClose={() => setComponentsOpen(false)}
                  onFly={flyToFeature}
                />
              </div>
            )}

            {/*
              One column for Layers + Inspector. On phones it is anchored above
              the toolbar row and grows upward; on desktop it returns to the
              top-right corner.
            */}
            <div className="pointer-events-auto absolute right-3 bottom-24 left-3 flex max-h-[62vh] flex-col gap-3 overflow-y-auto md:top-4 md:right-4 md:bottom-auto md:left-auto md:max-h-none md:w-64 md:overflow-visible">
              <div className={clsx(layersOpen ? 'block' : 'hidden', 'md:block')}>
                <LayersPanel onFlyHome={flyHome} capabilities={status.capabilities} />
              </div>
              {tool === 'house' && <HousePicker />}
              {!componentsOpen && <Inspector />}
            </div>

            {/* Toolbar: a scrollable row above the bottom edge on phones. */}
            <div className="pointer-events-auto absolute right-3 bottom-3 left-3 md:top-24 md:right-auto md:bottom-auto md:left-4">
              <Toolbar />
            </div>

            <div className="pointer-events-auto absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block">
              <HintBar />
            </div>
          </div>

          {status.tilesetError && (
            <div className="panel absolute bottom-6 left-4 z-20 max-w-xs rounded-lg p-3 text-[11px] text-amber-200">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <TriangleAlert size={13} /> Photorealistic tiles unavailable
              </div>
              <p className="text-slate-400">
                Falling back to Cesium World Terrain. {status.tilesetError}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
