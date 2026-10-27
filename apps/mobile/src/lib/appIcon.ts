/**
 * The home-screen icon follows the look. Since mobile v2.3.0 the primary
 * icon is Tally Pop's (app.json "icon", assets/images/icon-pop.png) and the
 * classic one is the "Classic" alternate (expo-alternate-app-icons), so the
 * default look never triggers iOS's "You have changed the icon" alert. A
 * build from before keeps its classic primary and has no "Classic"
 * alternate; asking for it fails quietly and the icon stays as it was.
 *
 * Loaded lazily and defensively: the module is native, so an over-the-air
 * update reaching a build made before it was added has no native side, and
 * requiring it there throws. In that case the icon simply stays put until
 * the next native build.
 */
type IconModule = {
  supportsAlternateIcons: boolean;
  setAlternateAppIcon: (name: "Classic" | null) => Promise<string | null>;
  /** The alternate showing, or null for the primary; "Pop" on a build from before v2.3.0 that switched to it. */
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
  try {
    const current = mod.getAppIconName() ?? null;
    if (pop) {
      // Already Pop: the primary on a current build, or the old "Pop"
      // alternate a build from before v2.3.0 may be showing -- leave it.
      if (current === null || current === "Pop") return;
      await mod.setAlternateAppIcon(null);
      return;
    }
    if (current === "Classic") return;
    try {
      await mod.setAlternateAppIcon("Classic");
    } catch {
      // A build from before v2.3.0: no "Classic" alternate, but its primary
      // icon is the classic one -- go back to it from the old "Pop".
      if (current === "Pop") await mod.setAlternateAppIcon(null);
    }
  } catch {
    // Not fatal: the look still changed; only the home-screen icon didn't.
  }
}
