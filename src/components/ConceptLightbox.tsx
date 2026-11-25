import { useEffect } from 'react';
import { ScanEye, X } from 'lucide-react';
import { selectFeatures, usePlannerStore } from '../state/store';
import { resolveConceptImage } from '../conceptImages';
import { sceneActions } from '../sceneActions';
import { Button } from './ui';

/** A concept pin's render, full-screen, over the map. */
export function ConceptLightbox() {
  const lightboxId = usePlannerStore((s) => s.lightboxId);
  const setLightbox = usePlannerStore((s) => s.setLightbox);
  const feature = usePlannerStore(selectFeatures).find((f) => f.id === lightboxId) ?? null;

  useEffect(() => {
    if (!feature) return;
    // Capture phase, so Escape closes the image without also dropping the
    // selection and tool the way it does on the map.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      setLightbox(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [feature, setLightbox]);

  if (!feature) return null;
  const image = resolveConceptImage(feature.props.imageId);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex flex-col bg-slate-950/90 p-3 backdrop-blur-sm md:p-8"
      onClick={() => setLightbox(null)}
      role="dialog"
      aria-label={feature.name}
    >
      <div className="mb-3 flex items-start justify-between gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{feature.name}</div>
          <div className="text-xs text-slate-400">{image.description}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="solid"
            onClick={() => {
              setLightbox(null);
              sceneActions.matchView?.(feature);
            }}
          >
            <ScanEye size={13} /> Match view
          </Button>
          <Button onClick={() => setLightbox(null)} title="Close (Esc)">
            <X size={15} />
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center">
        <img
          src={image.url}
          alt={image.description}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
