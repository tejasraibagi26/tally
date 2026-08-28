import { Platform, type ColorValue, type StyleProp, type ViewStyle } from "react-native";
import { Host } from "@expo/ui/swift-ui";
import { Slider, type SliderProps } from "@expo/ui";

// @expo/ui's Android Slider (Jetpack Compose, via requireNativeView) renders
// as a plain native view with no intrinsic content size of its own -- same
// failure mode as iOS's SwiftUI Host below, just without a console warning
// to find it by: with no explicit width/height it collapses to 0x0 and is
// silently invisible. @expo/ui's SliderProps type omits `style` even though
// every native view manager honors it at the RN shadow-tree/layout level
// regardless of what the module's own prop type declares -- this local cast
// is only papering over that type gap, not a runtime workaround.
const SizedSlider = Slider as React.ComponentType<SliderProps & { style?: StyleProp<ViewStyle> }>;

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
  return <SizedSlider value={value} onValueChange={onValueChange} min={min} max={max} step={step} style={{ width: "100%", height: 34 }} />;
}
