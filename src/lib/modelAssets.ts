/**
 * Tracks whether a GLB actually exists before Cesium is asked to load it.
 *
 * This matters more than it looks: handing Cesium a URL that resolves to the
 * dev server's SPA fallback makes it try to parse HTML as a model, and a model
 * load failure stops the render loop outright. So a miss has to be treated as
 * "not there" and fall back to the placeholder box.
 */

type Availability = boolean | undefined;

const resolved = new Map<string, boolean>();
const inFlight = new Map<string, Promise<boolean>>();
const listeners = new Set<() => void>();

/** `undefined` while the answer is still unknown. */
export function modelAvailability(url: string): Availability {
  return resolved.get(url);
}

export function onModelAvailabilityChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function probe(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return false;

    // A dev server with history fallback answers 200 text/html for a missing
    // file. Anything that is not binary is not a model.
    const type = response.headers.get('content-type') ?? '';
    return !type.startsWith('text/');
  } catch {
    return false;
  }
}

/** Starts a probe if one has not run yet; notifies listeners when it settles. */
export function ensureModelProbed(url: string) {
  if (resolved.has(url) || inFlight.has(url)) return;

  const promise = probe(url).then((available) => {
    resolved.set(url, available);
    inFlight.delete(url);
    for (const listener of listeners) listener();
    return available;
  });

  inFlight.set(url, promise);
}
