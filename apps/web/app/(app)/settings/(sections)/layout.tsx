import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";

// Settings is split into sections (components/settings/sections.ts): the menu
// stays put while each section page loads only what it shows. The changelog
// sits outside this group, so it keeps its own back-link header.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ui-page flex flex-col gap-6">
      <PageHeader title="Settings" />
      <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10 min-w-0">
        <SettingsNav />
        <div className="flex-1 min-w-0 max-w-[760px] flex flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}
