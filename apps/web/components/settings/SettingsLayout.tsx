import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One Settings section: an h2 with an optional one-line description, then a
 * single card of rows. `id` is the anchor the section menu (and links like
 * the alert emails' #alerts) scroll to.
 */
export function SettingsGroup({
  id,
  title,
  description,
  tone,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /** "negative" tints the card's border -- the Delete data section only. */
  tone?: "negative";
  children: ReactNode;
}) {
  return (
    <section id={id} data-settings-section className="scroll-mt-6 flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 className="m-0 text-base font-semibold text-text">{title}</h2>
        {description && <p className="m-0 text-[13.5px] text-text-2">{description}</p>}
      </div>
      <div
        className="bg-surface border border-border rounded-card divide-y divide-border"
        style={tone === "negative" ? { borderColor: "color-mix(in srgb, var(--negative) 45%, var(--border))" } : undefined}
      >
        {children}
      </div>
    </section>
  );
}

/** Label and description on the left, the current value or a control on the right. */
export function SettingsRow({
  title,
  description,
  htmlFor,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Makes the title a <label> for the control on the right. */
  htmlFor?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Title = htmlFor ? "label" : "span";
  return (
    <div className={cn("flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-[18px] py-3.5 min-h-14", className)}>
      <div className="flex-1 min-w-[200px] flex flex-col gap-0.5">
        <Title htmlFor={htmlFor} className="text-[14.5px] font-medium text-text">
          {title}
        </Title>
        {description && <span className="text-[13px] leading-snug text-text-2">{description}</span>}
      </div>
      {children && <div className="flex items-center gap-2 flex-none">{children}</div>}
    </div>
  );
}

/** A full-width block inside a group (a manager list, a history list) that isn't a single row. */
export function SettingsBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-[18px] py-4", className)}>{children}</div>;
}
