// Tee ordering helpers.
//
// Some courses name their tees with an explicit gender marker, e.g.
// "White (M)" / "White (W)". For those, players expect all the men's tees
// listed together first, then all the women's. Courses that DON'T use the
// convention should be left exactly as they are.
//
// `orderTeesByGender` does a STABLE sort that only moves women's-marked tees to
// the end, so within each group the incoming order (tier / rating) is preserved,
// and unmarked courses come out unchanged.

/** True when a tee name carries a women's marker like "(W)", "(Women)", "(Ladies)". */
export function isWomensTee(name: string): boolean {
  return /\(\s*(w|women'?s?|womens|ladies)\s*\)/i.test(name);
}

/**
 * Return a new array with women's-marked tees grouped after everything else,
 * preserving the original relative order within each group (stable). Non-mutating.
 */
export function orderTeesByGender<T extends { name: string }>(tees: T[]): T[] {
  return [...tees].sort(
    (a, b) => Number(isWomensTee(a.name)) - Number(isWomensTee(b.name))
  );
}
