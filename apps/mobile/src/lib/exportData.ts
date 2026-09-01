import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { apiGetText } from "@/lib/api";

// Native port of the web app's <a href="/api/export?format=..."> download
// links (apps/web/app/(app)/settings/page.tsx) -- a browser download has no
// mobile equivalent, so this fetches the same raw body (Content-Disposition
// is meaningless outside a browser and is just ignored here), writes it to
// a cache file, and hands it to the OS share sheet (AirDrop/Files/Drive/
// Mail/etc. on iOS, the share sheet's app list on Android) instead.
export async function exportTransactions(format: "csv" | "json"): Promise<void> {
  const content = await apiGetText(`/api/export?format=${format}`);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Sharing isn't available on this device.");

  const file = new File(Paths.cache, `tally-transactions.${format}`);
  file.create({ overwrite: true });
  file.write(content);

  await Sharing.shareAsync(file.uri, {
    mimeType: format === "csv" ? "text/csv" : "application/json",
    dialogTitle: "Export transactions",
    UTI: format === "csv" ? "public.comma-separated-values-text" : "public.json",
  });
}
