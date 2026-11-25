/**
 * Concept renders that can be pinned on the plan. Each one is a still of how a
 * part of the farm should look, and a Concept pin records where on the parcel
 * that shot was "taken" from and which way the camera faced.
 *
 * The files live in `public/concepts/` as web-sized WebP copies (2400 px on the
 * long side, plus a 560 px thumbnail). The full-resolution originals are kept
 * outside the repo.
 *
 * To add one: drop `NN-name.webp` and `NN-name-thumb.webp` into
 * `public/concepts/` and add an entry here. The view fields are starting
 * values for a new pin and can be tuned per pin in the inspector.
 */
export interface ConceptImage {
  id: string;
  label: string;
  description: string;
  url: string;
  thumbUrl: string;
  /** Width over height, so the map thumbnail keeps the image's shape. */
  aspect: number;
  /** Starting camera for a new pin showing this image. */
  view: {
    /** Metres above the ground. About 1.7 for eye level, tens for a drone shot. */
    eyeHeight: number;
    /** Degrees; negative tilts down. */
    pitch: number;
    /** Horizontal field of view in degrees. */
    fov: number;
  };
}

const WIDE = 16 / 9;

const concept = (
  file: string,
  label: string,
  description: string,
  view: ConceptImage['view'],
  aspect = WIDE,
): ConceptImage => ({
  id: file,
  aspect,
  label,
  description,
  url: `/concepts/${file}.webp`,
  thumbUrl: `/concepts/${file}-thumb.webp`,
  view,
});

export const CONCEPT_IMAGES: ConceptImage[] = [
  concept(
    '01-midday-wide',
    'Midday aerial',
    'High aerial over the drive, cottage, barn and pond at midday.',
    { eyeHeight: 70, pitch: -38, fov: 50 },
    3 / 4,
  ),
  concept(
    '02-sunrise-wide',
    'Sunrise aerial',
    'Low aerial of the homestead at sunrise, lanterns along the drive.',
    { eyeHeight: 30, pitch: -18, fov: 65 },
  ),
  concept(
    '03-sunrise-aged-stone',
    'Cottage and barn, sunrise',
    'The anchor shot: aged stone cottage with the arched door, barn to the right.',
    { eyeHeight: 8, pitch: -10, fov: 60 },
  ),
  concept(
    '04-drive-approach-sunrise',
    'Drive approach',
    'Coming up the gravel drive toward the cottage at sunrise.',
    { eyeHeight: 2.5, pitch: -4, fov: 60 },
  ),
  concept(
    '05-barnyard-sunrise',
    'Barnyard',
    'The stone barn and carriage from the barnyard.',
    { eyeHeight: 1.7, pitch: -2, fov: 60 },
  ),
  concept(
    '06-pond-view-sunrise',
    'Pond view',
    'Across the pond toward the barn and cottage, mist at sunrise.',
    { eyeHeight: 1.2, pitch: -2, fov: 70 },
  ),
  concept(
    '07-interior-kitchen-sunrise',
    'Cottage kitchen',
    'Inside the cottage: hearth, long tables, morning light.',
    { eyeHeight: 1.6, pitch: 0, fov: 75 },
  ),
];

export const DEFAULT_CONCEPT_IMAGE_ID = CONCEPT_IMAGES[0].id;

export function resolveConceptImage(id: string | undefined): ConceptImage {
  return CONCEPT_IMAGES.find((image) => image.id === id) ?? CONCEPT_IMAGES[0];
}
