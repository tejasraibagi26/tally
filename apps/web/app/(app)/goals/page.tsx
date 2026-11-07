import { sendToNewUi } from "@/lib/newUi";
import { requireUserId } from "@/lib/session";
import { GoalsTabs } from "@/components/goals/GoalsTabs";
import { YearEndGoal } from "@/components/goals/YearEndGoal";
import { RetirementGoal } from "@/components/fire/RetirementGoal";

export const metadata = { title: "Goals · Tally" };

/**
 * Goals: the year-end net worth goal and the early-retirement planner, one
 * page with a tab each (web v2.13.0 folded /fire in). ?view=retirement
 * picks the planner; ?start=zero plans it from $0 with nothing invested.
 */
export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ view?: string; start?: string }> }) {
  const userId = await requireUserId();
  await sendToNewUi(userId, "/new/plans");
  const { view, start } = await searchParams;
  if (view === "retirement") {
    return <RetirementGoal userId={userId} startFromZero={start === "zero"} tabs={<GoalsTabs active="retirement" />} />;
  }
  return <YearEndGoal userId={userId} tabs={<GoalsTabs active="year" />} />;
}
