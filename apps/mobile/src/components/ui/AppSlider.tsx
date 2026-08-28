import { Platform, type ColorValue } from "react-native";
import { Host } from "@expo/ui/swift-ui";
import { Slider } from "@expo/ui";

// @expo/ui's SwiftUI-backed components must be mounted inside a <Host> from
// '@expo/ui/swift-ui' on iOS -- without it, RN logs "A SwiftUI view ... is
// being mounted inside a standard UIView" and the control renders with zero
// size (silently invisible, no on-screen error). Android's Jetpack
// Compose-backed Slider needs no such wrapper. matchContents lets SwiftUI's
// own intrinsic layout size the host instead of guessing a fixed height.
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
  const slider = <Slider value={value} onValueChange={onValueChange} min={min} max={max} step={step} />;
  if (Platform.OS !== "ios") return slider;
  return (
    <Host style={{ width: "100%", height: 34 }} seedColor={tint}>
      {slider}
    </Host>
  );
}
