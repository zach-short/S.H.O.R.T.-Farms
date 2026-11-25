import clsx from 'clsx';
import { usePlannerStore } from '../state/store';
import { CONCEPT_IMAGES } from '../conceptImages';
import { Panel, PanelTitle } from './ui';

/** Choose which concept render the Concept tool pins next. */
export function ConceptPicker() {
  const conceptImageId = usePlannerStore((s) => s.conceptImageId);
  const setConceptImage = usePlannerStore((s) => s.setConceptImage);

  return (
    <Panel className="w-full">
      <PanelTitle>Concept image</PanelTitle>
      {/* A scrolling strip on phones so it does not bury the map; a grid on desktop. */}
      <div className="flex gap-1.5 overflow-x-auto px-1.5 pb-1.5 md:grid md:grid-cols-2 md:overflow-visible">
        {CONCEPT_IMAGES.map((image) => {
          const active = image.id === conceptImageId;
          return (
            <button
              key={image.id}
              onClick={() => setConceptImage(image.id)}
              aria-pressed={active}
              title={image.description}
              className={clsx(
                'w-28 shrink-0 overflow-hidden rounded-lg text-left ring-2 transition md:w-auto',
                active ? 'ring-amber-400' : 'ring-transparent hover:ring-white/30',
              )}
            >
              <img
                src={image.thumbUrl}
                alt=""
                loading="lazy"
                className="block aspect-video w-full bg-slate-800 object-cover"
              />
              <span
                className={clsx(
                  'block truncate px-1.5 py-1 text-[10px] font-medium',
                  active ? 'bg-amber-400/15 text-white' : 'text-slate-300',
                )}
              >
                {image.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="hidden border-t border-white/10 px-3 py-2 text-[10px] leading-relaxed text-slate-500 md:block">
        Click the map where this shot was taken from, then turn <b>Facing</b> until the cone
        points at the subject. <b>Match view</b> flies the camera into the shot.
      </p>
    </Panel>
  );
}
