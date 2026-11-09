import { requireUserId } from "@/lib/session";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsLayout";
import { GoalViewToggle } from "@/components/goalview/GoalViewToggle";
import { prefersGoalView } from "@/lib/goalView";

// Settings → Display.
export default async function DisplaySettingsPage() {
  const userId = await requireUserId();
  const goalView = await prefersGoalView(userId);
  return (
    <SettingsGroup id="display" title="Display" description="How Overview and Budgets read. Everything else in Tally looks the same either way.">
      <SettingsRow
        title="The goal view"
        description="Net worth leads with your year-end goal, your pace splits into what you saved and what markets did, and every budget says what going over costs the goal."
      >
        <GoalViewToggle enabled={goalView} />
      </SettingsRow>
    </SettingsGroup>
  );
}
