import { Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { Host as SwiftHost, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Host as ComposeHost, SingleChoiceSegmentedButtonRow, SegmentedButton, Text as ComposeText } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers";

/**
 * The OS's own segmented control: SwiftUI's segmented Picker on iOS (which
 * picks up Liquid Glass on iOS 26+ by itself, sliding selection included)
 * and Material 3's single-choice segmented buttons on Android. Spans its
 * parent's width; the height comes from the native control.
 */
export function NativeSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Read by screen readers as the control's name. */
  label: string;
}) {
  // The app's own theme (which can differ from the system's), so the
  // native control doesn't render light on a dark screen.
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";

  if (Platform.OS === "ios") {
    return (
      <SwiftHost matchContents={{ vertical: true }} colorScheme={scheme} style={{ width: "100%" }}>
        <Picker<string> label={label} selection={value} onSelectionChange={(next) => onChange(next as T)} modifiers={[pickerStyle("segmented")]}>
          {options.map((o) => (
            <SwiftText key={o} modifiers={[tag(o)]}>
              {o}
            </SwiftText>
          ))}
        </Picker>
      </SwiftHost>
    );
  }

  return (
    <ComposeHost matchContents={{ vertical: true }} colorScheme={scheme} style={{ width: "100%" }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        {options.map((o) => (
          <SegmentedButton key={o} selected={o === value} onClick={() => onChange(o)} modifiers={[weight(1)]}>
            <SegmentedButton.Label>
              <ComposeText>{o}</ComposeText>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </ComposeHost>
  );
}
