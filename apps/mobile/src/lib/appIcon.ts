/**
 * The home-screen icon follows the Tally Pop look: "Pop" (app.json's
 * expo-alternate-app-icons entry, assets/images/icon-pop.png) while Pop is
 * on, the default icon otherwise.
 *
 * Loaded lazily and defensively: the module is native, so an over-the-air
 * update reaching a build made before it was added has no native side, and
 * requiring it there throws. In that case the icon simply stays put until
 * the next native build.
 */
type IconModule = {
  supportsAlternateIcons: boolean;
  setAlternateAppIcon: (name: "Pop" | null) => Promise<string | null>;
  getAppIconName: () => string | null;
};

let cached: IconModule | null | undefined;

function iconModule(): IconModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-alternate-app-icons") as IconModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Switches only when the icon differs, so iOS's "You have changed the icon" alert shows once per real change. */
export async function syncAppIcon(pop: boolean): Promise<void> {
  const mod = iconModule();
  if (!mod?.supportsAlternateIcons) return;
  const want = pop ? "Pop" : null;
  try {
    if ((mod.getAppIconName() ?? null) === want) return;
    await mod.setAlternateAppIcon(want);
  } catch {
    // Not fatal: the look still changed; only the home-screen icon didn't.
  }
}
