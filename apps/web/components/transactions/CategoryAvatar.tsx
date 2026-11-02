import {
  ArrowLeftRight,
  Baby,
  Banknote,
  BookOpen,
  Building2,
  Car,
  CircleQuestionMark,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HeartPulse,
  House,
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
  TrainFront,
  Tv,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { transactionIconKey, type CategoryIconKey } from "@tally/core/categoryIcon";
import { cn } from "@/lib/cn";

/*
 * A transaction's category as its icon in the category's color on a soft
 * tinted circle (web v2.18.0, mobile's CategoryAvatar). Replaces the
 * merchant logo in transaction lists; the icon comes from
 * @tally/core/categoryIcon so both apps pick the same one. The tint is
 * --cat-tint of the color: 15% light, 22% dark (globals.css).
 */
const ICONS: Record<CategoryIconKey, LucideIcon> = {
  "shopping-cart": ShoppingCart, coffee: Coffee, utensils: Utensils, fuel: Fuel, train: TrainFront, car: Car, plane: Plane,
  home: House, zap: Zap, wifi: Wifi, smartphone: Smartphone, tv: Tv, music: Music, gamepad: Gamepad2,
  clapperboard: Clapperboard, receipt: Receipt, dumbbell: Dumbbell, pill: Pill, "heart-pulse": HeartPulse,
  sparkles: Sparkles, shirt: Shirt, "shopping-bag": ShoppingBag, gift: Gift, "paw-print": PawPrint, baby: Baby,
  "graduation-cap": GraduationCap, "book-open": BookOpen, shield: Shield, wrench: Wrench, hammer: Hammer,
  building: Building2, landmark: Landmark, "piggy-bank": PiggyBank, banknote: Banknote,
  "arrow-left-right": ArrowLeftRight, "circle-help": CircleQuestionMark, tag: Tag,
};

export function CategoryAvatar({
  categoryName,
  pfcDetailed,
  colorSlot,
  isTransfer = false,
  uncategorized = false,
  size = 28,
  className,
}: {
  categoryName: string | null | undefined;
  pfcDetailed?: string | null;
  colorSlot: number | null | undefined;
  isTransfer?: boolean;
  uncategorized?: boolean;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[transactionIconKey({ categoryName, pfcDetailed, isTransfer, uncategorized })];
  const tone = isTransfer ? "var(--text-3)" : uncategorized ? "var(--warning)" : colorSlot ? `var(--series-${colorSlot})` : "var(--text-3)";
  return (
    <span
      aria-hidden="true"
      className={cn("flex-none inline-flex items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, color: tone, background: `color-mix(in srgb, ${tone} var(--cat-tint, 15%), transparent)` }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
