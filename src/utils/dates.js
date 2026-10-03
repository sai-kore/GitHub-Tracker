export function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/*
 * Build a Mongo range filter from ?since= & ?until=
 */
export function dateRange(query) {
  const since = parseDate(query.since || query.from);
  const until = parseDate(query.until || query.to);

  if (!since && !until) return null;

  const range = {};
  if (since) range.$gte = since;
  if (until) range.$lte = until;
  return range;
}
