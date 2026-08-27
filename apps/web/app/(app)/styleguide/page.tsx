import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCents } from "@tally/core/money";

const COLOR_GROUPS = [
  {
    name: "Surfaces",
    swatches: ["canvas", "surface", "surface-2", "sunken", "border", "border-strong"],
  },
  {
    name: "Text",
    swatches: ["text", "text-2", "text-3"],
  },
  {
    name: "Brand & money",
    swatches: ["brand", "brand-hover", "brand-subtle", "positive", "negative", "warning", "info"],
  },
];

const SERIES = Array.from({ length: 8 }, (_, i) => `series-${i + 1}`);

export default function StyleguidePage() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-10 flex flex-col gap-10">
      <div>
        <h1 className="font-display text-5xl text-text mb-2">Styleguide</h1>
        <p className="text-text-2">Design tokens from DESIGN.md §14, rendered live.</p>
      </div>

      <section>
        <h3 className="text-base font-semibold text-text mb-3">Typography</h3>
        <Card className="p-6 flex flex-col gap-4">
          <span className="font-display text-[56px] leading-none text-text">$412,806.24</span>
          <span className="font-display text-4xl leading-none text-text">Display L</span>
          <h1 className="text-2xl font-semibold text-text">H1: Page title</h1>
          <h2 className="text-xl font-semibold text-text">H2: Panel title</h2>
          <p className="text-[15px] text-text">Body text, 15px/1.55, the default reading size.</p>
          <span className="text-xs font-medium uppercase tracking-wide text-text-2">Label text</span>
          <span className="font-mono text-xs text-text-3">Chase Sapphire ····4021 · txn_1PqR8kLm9vZt</span>
        </Card>
      </section>

      <section>
        <h3 className="text-base font-semibold text-text mb-3">Color</h3>
        <div className="flex flex-col gap-4">
          {COLOR_GROUPS.map((group) => (
            <Card key={group.name} className="p-5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3 mb-3 block">
                {group.name}
              </span>
              <div className="flex flex-wrap gap-3">
                {group.swatches.map((token) => (
                  <div key={token} className="flex flex-col gap-1.5 items-center">
                    <div
                      className="w-16 h-16 rounded-control border border-border"
                      style={{ background: `var(--${token})` }}
                    />
                    <span className="font-mono text-[11px] text-text-3">{token}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <Card className="p-5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3 mb-3 block">
              Chart series (fixed order, never cycle)
            </span>
            <div className="flex flex-wrap gap-3">
              {SERIES.map((token) => (
                <div key={token} className="flex flex-col gap-1.5 items-center">
                  <div
                    className="w-16 h-16 rounded-control border border-border"
                    style={{ background: `var(--${token})` }}
                  />
                  <span className="font-mono text-[11px] text-text-3">{token}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-text mb-3">Buttons</h3>
        <Card className="p-6 flex gap-3 flex-wrap">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Card>
      </section>

      <section>
        <h3 className="text-base font-semibold text-text mb-3">Status</h3>
        <Card className="p-6 flex gap-3 flex-wrap">
          <StatusBadge status="good" />
          <StatusBadge status="warning" />
          <StatusBadge status="serious" label="Due in 3 days" />
          <StatusBadge status="critical" label="Login expired" />
        </Card>
      </section>

      <section>
        <h3 className="text-base font-semibold text-text mb-3">Stat tile</h3>
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col gap-2.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Spent this month</span>
            <span className="font-display text-3xl text-text tabular money">{formatCents(214055)}</span>
            <span className="text-[13.5px] text-negative tabular">▲ 12% vs last month</span>
          </Card>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-text mb-3">Panel</h3>
        <Card>
          <CardHeader title="Example panel" meta="Updated 2h ago" />
          <div className="p-5 text-text-2 text-[15px]">Panel body content goes here.</div>
        </Card>
      </section>
    </div>
  );
}
