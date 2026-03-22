/** Normalized week column names (L8W = 8 weeks ago, L0W = current week). */
export const WEEK_KEYS = ['l8w', 'l7w', 'l6w', 'l5w', 'l4w', 'l3w', 'l2w', 'l1w', 'l0w'];

/** Labels for charts (human-readable week index). */
export const WEEK_LABELS = ['L8W', 'L7W', 'L6W', 'L5W', 'L4W', 'L3W', 'L2W', 'L1W', 'L0W'];

export function weekKeyFromOffset(offset) {
  if (offset < 0 || offset > 8) return null;
  return WEEK_KEYS[8 - offset];
}
