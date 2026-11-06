const DEFAULT_GHOST_AFTER_DAYS = 30;

/** Days an APPLIED job can sit unchanged before it counts as ghosted. Invalid values fall back to 30. */
export function ghostAfterDays(raw: string | undefined = process.env.GHOST_AFTER_DAYS): number {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : DEFAULT_GHOST_AFTER_DAYS;
}
