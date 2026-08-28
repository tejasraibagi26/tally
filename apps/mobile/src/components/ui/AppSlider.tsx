import { Platform, type ColorValue } from "react-native";
import { Host } from "@expo/ui/swift-ui";
import { Slider } from "@expo/ui";
import { Host as ComposeHost, Slider as ComposeSlider } from "@expo/ui/jetpack-compose";

// @expo/ui's Android Slider (Jetpack Compose, via requireNativeView) renders
// as a plain native view with no intrinsic content size of its own -- same
// failure mode as iOS's SwiftUI Host below, just without a console warning
// to find it by: with no explicit width/height it collapses to 0x0 and is
// silently invisible. Unlike iOS, the universal `Slider` from "@expo/ui"
// doesn't help here on Android: its Android implementation renders the bare
// jetpack-compose Slider directly with no `<Host>` wrapper, and `style`
// isn't even in its prop type -- it's destructured away before ever
// reaching the native view, not merely mistyped. Sizing it means going
// around the universal wrapper and using `@expo/ui/jetpack-compose`'s
// `Host` + `Slider` directly, the same way the iOS branch below uses
// `@expo/ui/swift-ui`'s `Host`.
function AndroidSlider({
  value,
  onValueChange,
  min,
  max,
  step,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  // Jetpack Compose's Slider takes a step *count* between min/max, not an
  // increment size -- same conversion @expo/ui's own community/slider
  // wrapper does for its Android target.
  const steps = step && step > 0 ? Math.max(0, Math.round((max - min) / step) - 1) : 0;
  return (
    <ComposeHost matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <ComposeSlider value={value} onValueChange={onValueChange} min={min} max={max} steps={steps} />
    </ComposeHost>
  );
}

// @expo/ui's SwiftUI-backed components must be mounted inside a <Host> from
// '@expo/ui/swift-ui' on iOS -- without it, RN logs "A SwiftUI view ... is
// being mounted inside a standard UIView" and the control renders with zero
// size (silently invisible, no on-screen error).
export function AppSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  tint,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  tint?: ColorValue;
}) {
  if (Platform.OS === "ios") {
    return (
      <Host style={{ width: "100%", height: 34 }} seedColor={tint}>
        <Slider value={value} onValueChange={onValueChange} min={min} max={max} step={step} />
      </Host>
    );
  }
  return <AndroidSlider value={value} onValueChange={onValueChange} min={min} max={max} step={step} />;
}
