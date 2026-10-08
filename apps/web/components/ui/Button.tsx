import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-solid";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * DESIGN.md §8: an inline 14px spinner beside the label, which stays. Also
   * disables the button. Passing this at all (true or false) reserves the
   * spinner's room, so the button is the same size idle and busy.
   */
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  secondary: "bg-surface border border-border-strong text-text hover:bg-sunken",
  ghost: "bg-transparent text-text hover:bg-sunken",
  destructive: "bg-transparent text-negative hover:bg-negative-subtle",
  // Solid destructive is only for the confirm button inside a confirm dialog (DESIGN.md §8).
  "destructive-solid": "bg-negative text-surface hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-[30px] px-3 text-sm",
  md: "h-9 px-3 text-[15px]",
  lg: "h-11 px-4 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, disabled, loading, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || !!loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info",
        disabled && !loading && "opacity-40 cursor-not-allowed",
        loading && "cursor-progress",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading === undefined ? (
        children
      ) : (
        // Both layouts share one grid cell: the invisible copy (spinner +
        // label) sets the width, so starting or finishing never resizes it.
        <span className="grid">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1 flex items-center justify-center gap-2">
            <Spinner />
            {children}
          </span>
          <span className="col-start-1 row-start-1 flex items-center justify-center gap-2">
            {loading && <Spinner />}
            {children}
          </span>
        </span>
      )}
    </button>
  );
});

/** 14px ring in the current text color. */
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="w-3.5 h-3.5 flex-none rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none opacity-80"
    />
  );
}
