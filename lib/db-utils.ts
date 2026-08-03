/**
 * Deep-clone a value using structuredClone.
 * Prevents accidental mutation of shared state by reference.
 *
 * Used by repositories to ensure callers cannot mutate shared database state.
 */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
