/** Deterministic small rotation (-3.5°..3.5°) so stamps feel hand-placed. */
export function stampRotation(index: number): number {
  return (((index * 37) % 15) - 7) / 2
}
