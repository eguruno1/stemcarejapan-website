import { logError } from './logger';
const pending = new Set<Promise<unknown>>();
export function trackBackground(work: Promise<unknown>): void {
  const guarded = work.catch(err => logError(err, 'background_failed')).finally(() => pending.delete(guarded));
  pending.add(guarded);
}
export async function drainBackground(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending]);
}
