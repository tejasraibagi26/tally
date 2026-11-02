import { View } from "react-native";
import { useColorScheme } from "nativewind";
import {
  ArrowLeftRight,
  Baby,
  Banknote,
  BookOpen,
  Building2,
  Car,
  CircleHelp,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Landmark,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Train,
  Tv,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { transactionIconKey, type CategoryIconKey } from "@tally/core/categoryIcon";
import { chartSeries, withAlpha } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

/*
 * A transaction's category as its icon in the category's color on a soft
 * tinted circle (mobile v2.19.0; replaces the merchant logo in lists). The
 * icon comes from @tally/core/categoryIcon, shared with web's CategoryAvatar.
 */
const ICONS: Record<CategoryIconKey, LucideIcon> = {
  "shopping-cart": ShoppingCart, coffee: Coffee, utensils: Utensils, fuel: Fuel, train: Train, car: Car, plane: Plane,
  home: Home, zap: Zap, wifi: Wifi, smartphone: Smartphone, tv: Tv, music: Music, gamepad: Gamepad2,
  clapperboard: Clapperboard, receipt: Receipt, dumbbell: Dumbbell, pill: Pill, "heart-pulse": HeartPulse,
  sparkles: Sparkles, shirt: Shirt, "shopping-bag": ShoppingBag, gift: Gift, "paw-print": PawPrint, baby: Baby,
  "graduation-cap": GraduationCap, "book-open": BookOpen, shield: Shield, wrench: Wrench, hammer: Hammer,
  building: Building2, landmark: Landmark, "piggy-bank": PiggyBank, banknote: Banknote,
  "arrow-left-right": ArrowLeftRight, "circle-help": CircleHelp, tag: Tag,
};

export function CategoryAvatar({
  categoryName,
  pfcDetailed,
  colorSlot,
  isTransfer = false,
  uncategorized = false,
  size,
}: {
  categoryName: string | null | undefined;
  pfcDetailed?: string | null;
  colorSlot: number | null | undefined;
  isTransfer?: boolean;
  uncategorized?: boolean;
  size: number;
  /** Unused since the circle (v2.19.3+); kept so call sites needn't change. */
  radius?: number;
}) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const series = dark ? chartSeries.dark : chartSeries.light;
  const Icon = ICONS[transactionIconKey({ categoryName, pfcDetailed, isTransfer, uncategorized })];
  const tone = isTransfer
    ? colors["text-3"]!
    : uncategorized
      ? colors.warning!
      : colorSlot
        ? series[(colorSlot - 1) % series.length]!
        : colors["text-3"]!;
  // A soft circle (mobile v2.19.4, the user's pick from the canvas's eight
  // options): a tint of the category color behind the icon in the full color.
  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(tone, dark ? 0.22 : 0.15) }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Icon size={Math.round(size * 0.5)} color={tone} strokeWidth={2} />
    </View>
  );
}
