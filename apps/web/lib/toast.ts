/**
 * App-wide toast (DESIGN.md §8: bottom-right, 4s). Fired as a window event so
 * anything -- a hook that has just navigated away, a button on any page --
 * can show one; components/ui/Toaster.tsx, mounted once in the app layout,
 * renders it. Sync failures don't go here: they're persistent banners.
 */
export const TOAST_EVENT = "tally:toast";

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastDetail {
  message: string;
  /** "negative" only for a quick, retryable action failing (e.g. a bulk edit). */
  tone: "positive" | "negative";
  /** e.g. Undo. A toast with an action holds 6s instead of 4. */
  action?: ToastAction;
}

export function showToast(message: string, tone: ToastDetail["tone"] = "positive", action?: ToastAction) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, tone, action } }));
}
