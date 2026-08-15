export function reconcileSavedDraft<T>(
  current: T,
  submittedSnapshot: T,
  normalized: T,
  equals: (left: T, right: T) => boolean = Object.is,
): T {
  return equals(current, submittedSnapshot) ? normalized : current;
}
