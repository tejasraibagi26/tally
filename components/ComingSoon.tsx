import { Card } from "@/components/ui/Card";

export function ComingSoon({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">{title}</h1>
      <Card className="p-12 flex flex-col items-center gap-2 text-center">
        <span className="font-display text-3xl text-text">Coming in {milestone}</span>
        <p className="text-text-2 text-[15px]">Scoped and specified in WORK.md §12 — not yet built.</p>
      </Card>
    </div>
  );
}
