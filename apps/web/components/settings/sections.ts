/**
 * Settings is split into sections, one URL each, listed in the menu beside
 * them (app/(app)/settings/(sections)/layout.tsx). Account sits at /settings
 * itself, so the sidebar's Settings link and old bare /settings links land
 * on it.
 */
export const SETTINGS_SECTIONS = [
  { href: "/settings", label: "Account", hint: "Profile and password" },
  { href: "/settings/notifications", label: "Notifications", hint: "Email alerts and recap" },
  { href: "/settings/income", label: "Income & safe to spend", hint: "Paycheque, accounts, cushion" },
  { href: "/settings/display", label: "Display", hint: "The goal view" },
  { href: "/settings/data", label: "Data & developer", hint: "Export, API tokens" },
  { href: "/settings/danger", label: "Danger zone", hint: "Delete or wipe data" },
] as const;

/**
 * Where an old one-page anchor (/settings#alerts, from alert emails already
 * sent) now lives. The hash never reaches the server, so the Account page
 * forwards it client-side (LegacyHashRedirect). Null: it's already on
 * Account, or unknown.
 */
export function legacySettingsHashTarget(hash: string): string | null {
  switch (hash.replace(/^#/, "")) {
    case "alerts":
      return "/settings/notifications";
    case "income":
      return "/settings/income";
    case "safe-to-spend":
      return "/settings/income#safe-to-spend";
    case "display":
      return "/settings/display";
    case "data":
    case "developer":
      return "/settings/data";
    case "delete":
      return "/settings/danger";
    default:
      return null;
  }
}
