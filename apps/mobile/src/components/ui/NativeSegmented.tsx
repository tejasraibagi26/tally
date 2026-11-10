import { Platform } from "react-native";
import { useColorScheme } from "nativewind";
import { Host as SwiftHost, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { controlSize, fixedSize, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Host as ComposeHost, SingleChoiceSegmentedButtonRow, SegmentedButton, Text as ComposeText } from "@expo/ui/jetpack-compose";
import { height, width } from "@expo/ui/jetpack-compose/modifiers";

/**
 * The OS's own segmented control: SwiftUI's segmented Picker on iOS (which
 * picks up Liquid Glass on iOS 26+ by itself, sliding selection included)
 * and Material 3's single-choice segmented buttons on Android. Compact:
 * the small control size, sized to its own segments (it sits beside a
 * title, not across the screen).
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
      <SwiftHost matchContents colorScheme={scheme}>
        <Picker<string>
          label={label}
          selection={value}
          onSelectionChange={(next) => onChange(next as T)}
          modifiers={[pickerStyle("segmented"), controlSize("small"), fixedSize()]}
        >
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
    <ComposeHost matchContents colorScheme={scheme}>
      <SingleChoiceSegmentedButtonRow modifiers={[height(34)]}>
        {options.map((o) => (
          <SegmentedButton key={o} selected={o === value} onClick={() => onChange(o)} modifiers={[width(52)]}>
            <SegmentedButton.Label>
              <ComposeText style={{ fontSize: 12 }}>{o}</ComposeText>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </ComposeHost>
  );
}
