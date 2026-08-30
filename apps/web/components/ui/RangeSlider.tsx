import { cn } from "@/lib/cn";

/**
 * A bare `<input type="range">` styled only via `accent-color` renders its
 * native track/thumb, and Chrome on Windows draws that native track with a
 * dithered/dotted fill at non-integer device-pixel widths — it reads as
 * visibly broken rather than a clean two-tone bar. Fully custom-drawing the
 * track (this component) sidesteps native rendering entirely, matching the
 * solid `bg-sunken`/`bg-brand` progress bar used elsewhere (e.g.
 * FireCalculator's FIRE-number bar).
 *
 * The fill itself is a `linear-gradient` on `::-webkit-slider-runnable-track`
 * (Firefox instead gets `::-moz-range-progress`, which clips to the value
 * natively) driven by the `--range-fill` custom property set inline on the
 * input — CSS custom properties cascade into an element's own pseudo-elements,
 * so this stays one element instead of a separate overlay div.
 */
export function RangeSlider({
  value,
  min,
  max,
  step,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ "--range-fill": `${pct}%` } as React.CSSProperties}
      className={cn(
        "w-full h-2 cursor-pointer appearance-none bg-transparent",
        "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full",
        "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--brand)_var(--range-fill),var(--sunken)_var(--range-fill))]",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
        "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--surface)]",
        "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-sunken",
        "[&::-moz-range-progress]:h-2 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-brand",
        "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
        "[&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:shadow-[0_0_0_2px_var(--surface)]",
        className,
      )}
    />
  );
}
