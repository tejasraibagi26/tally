import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { tagsFor } from "@/lib/tags";
import { dollars, shortDate } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";

export default async function NewTagsPage() {
  const userId = await requireUserId();
  const tags = await tagsFor(userId);

  return (
    <main className="tn-main">
      <NewSubNav section="everything" />
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="tn-disp" style={{ margin: 0, fontSize: "clamp(32px, 4vw, 40px)", fontWeight: 700 }}>
          Tags
        </h1>
        <p style={{ margin: 0, color: "var(--tn-ink-3)", maxWidth: "60ch" }}>
          Tags group spending across categories, like a trip or a renovation. Add them to a transaction from Activity, or let a rule add them for you.
        </p>
      </section>

      {tags.length === 0 ? (
        <div className="tn-card tn-empty">No tags yet.</div>
      ) : (
        <section className="tn-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {tags.map((t) => (
            <Link key={t.tag} href={`/new/activity?tag=${encodeURIComponent(t.tag)}`} className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 4, color: "var(--tn-ink)", textDecoration: "none" }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>#{t.tag}</span>
              <span className="tn-disp money" style={{ fontSize: 30, fontWeight: 700 }}>
                {dollars(t.spend)}
              </span>
              <span className="tn-muted" style={{ fontSize: 13 }}>
                {t.count} transaction{t.count === 1 ? "" : "s"} · {t.firstDate === t.lastDate ? shortDate(t.firstDate) : `${shortDate(t.firstDate)} – ${shortDate(t.lastDate)}`}
              </span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
