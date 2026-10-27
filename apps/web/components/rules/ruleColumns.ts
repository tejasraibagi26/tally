/**
 * The rules table's columns, shared by the header the Rules page draws and
 * the rows RuleRow renders, so the two line up.
 *
 * Its own module, not an export of RuleRow: that file is "use client", and
 * a server component importing a value from a client module gets a client
 * reference instead of the string -- the header silently lost its grid.
 */
export const RULE_COLUMNS = "grid grid-cols-[76px_minmax(0,1fr)_72px_60px] gap-x-3 items-center px-4";
