import { View } from "react-native";
import { useColorScheme } from "nativewind";
import {
  ArrowLeftRight,
  Baby,
  Banknote,
  BookOpen,
  Building2,
  Car,
  Clapperboard,
  Coffee,
  CircleHelp,
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
import { chartSeries, withAlpha } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

/*
 * A transaction's category as its icon in the category's color on a soft
 * tinted circle (mobile v2.19.0; replaces the merchant logo in lists). Categories are the
 * user's own names, so the icon is matched from the name first, then from
 * Plaid's category (pfcDetailed) when the name says nothing, then a tag.
 */

// First match wins, so the specific patterns sit above the broad ones.
const BY_NAME: [RegExp, LucideIcon][] = [
  [/grocer|supermarket|food basics|produce/i, ShoppingCart],
  [/coffee|caf[eé]/i, Coffee],
  [/restaurant|dining|eat(ing)? out|takeout|take-out|food|lunch|dinner|bar\b|pub/i, Utensils],
  [/gas\b|fuel|petrol/i, Fuel],
  [/transit|bus\b|train|subway|presto|metro/i, Train],
  [/taxi|uber|lyft|ride|car\b|auto|parking|vehicle/i, Car],
  [/flight|travel|trip|vacation|hotel|airbnb/i, Plane],
  [/rent|mortgage|housing|home\b|house/i, Home],
  [/hydro|electric|utilit|water|power|energy/i, Zap],
  [/internet|wifi/i, Wifi],
  [/phone|mobile|cell/i, Smartphone],
  [/stream|netflix|tv\b|movie|cinema/i, Tv],
  [/music|spotify/i, Music],
  [/game|gaming/i, Gamepad2],
  [/entertain|fun|hobb/i, Clapperboard],
  [/subscri|membership/i, Receipt],
  [/gym|fitness|sport|yoga/i, Dumbbell],
  [/pharm|drug/i, Pill],
  [/health|medical|doctor|dental|clinic/i, HeartPulse],
  [/beauty|personal care|hair|salon|spa/i, Sparkles],
  [/cloth|apparel|fashion|shoe/i, Shirt],
  [/shop|amazon|online|store|merch|superstore/i, ShoppingBag],
  [/gift|donat|charit/i, Gift],
  [/pet|vet\b/i, PawPrint],
  [/kid|child|baby|daycare/i, Baby],
  [/school|tuition|educat|course/i, GraduationCap],
  [/book/i, BookOpen],
  [/insur/i, Shield],
  [/repair|maintenance|service/i, Wrench],
  [/home improvement|hardware|furnit/i, Hammer],
  [/tax|government|fee|bank/i, Building2],
  [/loan|debt|interest/i, Landmark],
  [/saving|invest/i, PiggyBank],
  [/pay(check|cheque)|salary|wage|income|refund/i, Banknote],
  [/transfer/i, ArrowLeftRight],
];

// Plaid's primary category, the prefix of pfcDetailed.
const BY_PFC: [string, LucideIcon][] = [
  ["FOOD_AND_DRINK_GROCERIES", ShoppingCart],
  ["FOOD_AND_DRINK_COFFEE", Coffee],
  ["FOOD_AND_DRINK", Utensils],
  ["TRANSPORTATION_GAS", Fuel],
  ["TRANSPORTATION_PUBLIC_TRANSIT", Train],
  ["TRANSPORTATION", Car],
  ["TRAVEL", Plane],
  ["RENT_AND_UTILITIES_RENT", Home],
  ["RENT_AND_UTILITIES_INTERNET", Wifi],
  ["RENT_AND_UTILITIES_TELEPHONE", Smartphone],
  ["RENT_AND_UTILITIES", Zap],
  ["ENTERTAINMENT_TV_AND_MOVIES", Tv],
  ["ENTERTAINMENT_MUSIC", Music],
  ["ENTERTAINMENT", Clapperboard],
  ["PERSONAL_CARE_GYMS", Dumbbell],
  ["PERSONAL_CARE", Sparkles],
  ["MEDICAL_PHARMACIES", Pill],
  ["MEDICAL", HeartPulse],
  ["GENERAL_MERCHANDISE_CLOTHING", Shirt],
  ["GENERAL_MERCHANDISE", ShoppingBag],
  ["HOME_IMPROVEMENT", Hammer],
  ["GENERAL_SERVICES_INSURANCE", Shield],
  ["GENERAL_SERVICES", Wrench],
  ["GOVERNMENT_AND_NON_PROFIT_DONATIONS", Gift],
  ["GOVERNMENT_AND_NON_PROFIT", Building2],
  ["BANK_FEES", Building2],
  ["LOAN_PAYMENTS", Landmark],
  ["INCOME", Banknote],
  ["TRANSFER", ArrowLeftRight],
];

export function categoryIcon(name: string | null | undefined, pfcDetailed: string | null | undefined): LucideIcon {
  if (name) for (const [re, icon] of BY_NAME) if (re.test(name)) return icon;
  if (pfcDetailed) for (const [prefix, icon] of BY_PFC) if (pfcDetailed.startsWith(prefix)) return icon;
  return Tag;
}

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

  let Icon: LucideIcon;
  let tone: string;
  if (isTransfer) {
    Icon = ArrowLeftRight;
    tone = colors["text-3"]!;
  } else if (uncategorized) {
    Icon = CircleHelp;
    tone = colors.warning!;
  } else {
    Icon = categoryIcon(categoryName, pfcDetailed);
    tone = colorSlot ? series[(colorSlot - 1) % series.length]! : colors["text-3"]!;
  }
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
