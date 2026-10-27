import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

export type DialogTone = "brand" | "positive" | "warning" | "negative";

// The backdrop blur, best first, checked once. expo-blur (UIBlurEffect)
// works on every iOS version; it's loaded only when this build has its
// native side, since an over-the-air update can reach a build made before
// it was added (mobile v2.1.4). Without it, iOS 26's glass; else the scrim.
type BlurComponent = (props: { intensity?: number; tint?: "dark" | "light" | "default"; style?: object }) => ReactNode;
const NativeBlur: BlurComponent | null = (() => {
  if (Platform.OS !== "ios" || !requireOptionalNativeModule("ExpoBlur")) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("expo-blur") as { BlurView: BlurComponent }).BlurView;
  } catch {
    return null;
  }
})();
const BLUR_AVAILABLE = NativeBlur == null && Platform.OS === "ios" && isLiquidGlassAvailable();

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant: "danger" | "primary" | "secondary";
  /** Spinner beside the label; the label stays. */
  loading?: boolean;
  disabled?: boolean;
}

/**
 * The centered dialog for high-stakes, irreversible actions (MOBILE_DESIGN.md
 * §2: confirms stay centered, never a sheet) -- revoking a connection, wiping
 * all data. Unlike a system alert it can list what's affected, hold a field,
 * show progress, and show a failure in place. Simple yes/no confirms stay
 * native Alert.alert. Enter: 180ms fade + scale .98→1; exit: 120ms fade.
 */
export function TallyDialog({
  visible,
  onClose,
  dismissible = true,
  tone,
  icon,
  title,
  subtitle,
  children,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  /** False while its action runs: backdrop taps and Android back do nothing. */
  dismissible?: boolean;
  tone: DialogTone;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Stacked full-width, action first, Cancel last. */
  actions: DialogAction[];
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduceMotion) anim.setValue(1);
      else Animated.timing(anim, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else if (mounted) {
      if (reduceMotion) {
        anim.setValue(0);
        setMounted(false);
      } else {
        Animated.timing(anim, { toValue: 0, duration: 120, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setMounted(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion]);

  if (!mounted) return null;
  const blur = BLUR_AVAILABLE;
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [visible ? 0.98 : 1, 1] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismissible ? onClose : () => {}} statusBarTranslucent>
      {/* The screen behind is blurred, like web's modal (backdrop-blur over
          the scrim): iOS 26's glass material, tinted dark so it still dims.
          Without liquid glass (Android, older iOS) the plain scrim stays. */}
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: NativeBlur ? "rgba(0,0,0,0.22)" : blur ? undefined : "rgba(0,0,0,0.42)", opacity: anim }}>
        {NativeBlur && <NativeBlur intensity={45} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
        {blur && <GlassView glassEffectStyle="regular" tintColor="rgba(0,0,0,0.28)" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
        <Pressable style={{ flex: 1 }} onPress={dismissible ? onClose : undefined} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center", alignItems: "center" }} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          className="bg-raised rounded-panel"
          style={{
            width: Math.min(width - 44, 420),
            padding: 20,
            gap: 14,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: anim,
            transform: [{ scale }],
          }}
        >
          <View className="flex-row items-start gap-3.5">
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors[`${tone}-subtle`], alignItems: "center", justifyContent: "center" }}>{icon}</View>
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }} accessibilityRole="header">
                {title}
              </Text>
              {subtitle && <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>{subtitle}</Text>}
            </View>
          </View>
          {children}
          <View style={{ gap: 8, marginTop: 2 }}>
            {actions.map((a) => (
              <DialogButton key={a.label} action={a} />
            ))}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DialogButton({ action }: { action: DialogAction }) {
  const colors = useThemeColors();
  const rf = useRF();
  const fg = action.variant === "danger" ? colors.surface! : action.variant === "primary" ? colors["on-brand"]! : colors.text!;
  const bg = action.variant === "danger" ? colors.negative! : action.variant === "primary" ? colors.brand! : colors["surface-2"]!;
  const off = action.disabled || action.loading;
  return (
    <Pressable
      onPress={action.onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!action.loading }}
      className="rounded-full flex-row items-center justify-center gap-2 active:opacity-90"
      style={[
        { height: 48, backgroundColor: bg, opacity: action.disabled && !action.loading ? 0.4 : 1 },
        action.variant === "secondary" ? { borderWidth: 1, borderColor: colors.border } : null,
      ]}
    >
      {action.loading && <ActivityIndicator size="small" color={fg} />}
      <Text className="font-ui-semibold" style={{ fontSize: rf(15), color: fg }}>
        {action.label}
      </Text>
    </Pressable>
  );
}

/** An inline failure inside a dialog or sheet: icon + text on the negative-subtle fill. */
export function DialogError({ icon, children }: { icon: ReactNode; children: string }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="flex-row items-start gap-2.5 rounded-[10px] px-3 py-2.5" style={{ backgroundColor: colors["negative-subtle"] }} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      {icon}
      <Text className="font-ui text-text-2 flex-1" style={{ fontSize: rf(13), lineHeight: rf(18) }}>{children}</Text>
    </View>
  );
}
