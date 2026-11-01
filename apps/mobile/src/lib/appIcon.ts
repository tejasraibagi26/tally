/**
 * The home-screen icon. Pop's is the primary icon (app.json "icon",
 * assets/images/icon-pop.png). Until mobile v2.10.0 the classic look could
 * switch to the "Classic" alternate (expo-alternate-app-icons), and a build
 * from before v2.3.0 may show the old "Pop" alternate; resetAppIcon puts
 * the primary back from the former and leaves the latter (it is Pop's).
 *
 * Loaded lazily and defensively: the module is native, so an over-the-air
 * update reaching a build made before it was added has no native side, and
 * requiring it there throws. In that case the icon simply stays put.
 */
type IconModule = {
  supportsAlternateIcons: boolean;
  setAlternateAppIcon: (name: string | null) => Promise<string | null>;
  getAppIconName: () => string | null;
};

function iconModule(): IconModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-alternate-app-icons") as IconModule;
  } catch {
    return null;
  }
}

/** Switches only when the Classic icon is showing, so iOS's "You have changed the icon" alert never shows otherwise. */
export async function resetAppIcon(): Promise<void> {
  const mod = iconModule();
  if (!mod?.supportsAlternateIcons) return;
  try {
    if (mod.getAppIconName() === "Classic") await mod.setAlternateAppIcon(null);
  } catch {
    // Not fatal: only the home-screen icon stays as it was.
  }
}
