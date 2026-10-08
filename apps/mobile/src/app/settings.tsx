import { useCallback, useEffect, useState, type ReactNode } from "react";
import { View, Text, ScrollView, Pressable, Switch, ActivityIndicator, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { AlertTriangle, Bell, ChevronRight, Download, KeyRound, Lock, Mail, ScanFace, SunMoon, Trash2, Wallet } from "lucide-react-native";
import { exportTransactions } from "@/lib/exportData";
import { useAccountProfile, useUpdateAccountProfile, useUpdateRecaps, useChangePassword, useWipeAccount } from "@/lib/queries/account";
import { useAlertPreferences } from "@/lib/queries/alerts";
import { useIncomeSchedules } from "@/lib/queries/incomeSchedules";
import { useApiTokens } from "@/lib/queries/apiTokens";
import { useAccounts } from "@/lib/queries/accounts";
import { useAuth } from "@/lib/AuthContext";
import { ApiError, NetworkError } from "@/lib/api";
import { FormSheet, SheetField, SheetInput } from "@/components/ui/FormSheet";
import { SimplePickerSheet } from "@/components/ui/SimplePickerSheet";
import { TallyDialog, DialogError } from "@/components/ui/TallyDialog";
import { Toast } from "@/components/ui/Toast";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useThemeColors } from "@/theme/useThemeColors";
import { type AppearanceMode, getStoredAppearanceMode, storeAppearanceMode } from "@/theme/appearance";
import { hairline } from "@/theme/colors";
import { useRF } from "@/theme/responsiveFont";
import { APP_VERSION } from "@/lib/version";

/** Let a closing sheet finish before presenting another native modal (iOS won't stack on one animating out). */
const SHEET_CLOSE_MS = 350;

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof NetworkError) return "Couldn't reach Tally. Check your connection and try again.";
  if (err instanceof ApiError && err.message) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// List building blocks: a captioned group of 46pt rows (MOBILE_DESIGN.md §5,
// Settings). A row either changes something in place (switch, segmented
// control) or opens something (chevron).
// ---------------------------------------------------------------------------

function Group({ caption, children }: { caption: string; children: ReactNode }) {
  const rf = useRF();
  return (
    <View className="gap-1.5">
      <Text className="font-ui-semibold text-text-3 px-1" style={{ fontSize: rf(11.5), letterSpacing: 0.6, textTransform: "uppercase" }} accessibilityRole="header">
        {caption}
      </Text>
      <View className="bg-surface rounded-[16px] overflow-hidden">{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  right,
  onPress,
  destructive,
  first,
  busy,
  accessibilityHint,
}: {
  icon: (color: string) => ReactNode;
  label: string;
  /** Short current value, shown before the chevron. */
  value?: string;
  /** A control in place of value + chevron (switch, segmented control). */
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const tint = destructive ? colors.negative! : colors["text-2"]!;
  const body = (
    <View className="flex-row items-center gap-3 px-3.5" style={[{ minHeight: 48 }, first ? null : { borderTopWidth: 1, borderTopColor: hairline(colors) }]}>
      <View
        style={{ width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: destructive ? colors["negative-subtle"] : colors.sunken }}
      >
        {icon(tint)}
      </View>
      <Text className={destructive ? "font-ui-medium text-negative flex-1" : "font-ui-medium text-text flex-1"} style={{ fontSize: rf(14.5) }} numberOfLines={1}>
        {label}
      </Text>
      {right ?? (
        <>
          {busy && <ActivityIndicator size="small" color={colors["text-3"]} />}
          {value != null && (
            <Text className="font-ui text-text-3" style={{ fontSize: rf(13.5), fontVariant: ["tabular-nums"] }} numberOfLines={1}>
              {value}
            </Text>
          )}
          {onPress && <ChevronRight size={16} color={colors["text-3"]} />}
        </>
      )}
    </View>
  );
  if (!onPress || right) return body;
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} accessibilityHint={accessibilityHint} className="active:bg-sunken">
      {body}
    </Pressable>
  );
}

function ThemedSwitch({ value, onValueChange, disabled, label }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  const colors = useThemeColors();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ false: colors["border-strong"], true: colors.brand }}
      ios_backgroundColor={colors["border-strong"]}
    />
  );
}

const APPEARANCE_OPTIONS: { mode: AppearanceMode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "system", label: "Auto" },
];

/** Compact segmented control that fits in a row. */
function AppearanceSegments() {
  const { setColorScheme } = useColorScheme();
  const rf = useRF();
  const [selected, setSelected] = useState<AppearanceMode>("system");

  useEffect(() => {
    getStoredAppearanceMode().then(setSelected);
  }, []);

  async function choose(mode: AppearanceMode) {
    setSelected(mode);
    await storeAppearanceMode(mode);
    setColorScheme(mode);
  }

  return (
    <View className="flex-row rounded-[9px] bg-sunken" style={{ padding: 2 }} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
      {APPEARANCE_OPTIONS.map(({ mode, label }) => {
        const active = selected === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => choose(mode)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 8, bottom: 8 }}
            className={active ? "rounded-[7px] bg-surface px-2.5 py-1" : "rounded-[7px] px-2.5 py-1"}
          >
            <Text className={active ? "font-ui-semibold text-text" : "font-ui text-text-2"} style={{ fontSize: rf(12.5) }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

// A grouped list: profile card, then Preferences, Notifications, Data,
// Account. Nothing expands in place -- edits open a FormSheet, export a
// picker sheet, wipe a TallyDialog. Success is a toast; errors sit inline
// in whatever opened them. Accounts isn't linked here (it's a tab), and
// Sign out stays in the More sheet.
export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const contentTop = useScreenContentTop();
  const rf = useRF();
  const { data: profile, isLoading } = useAccountProfile();
  const { data: alertPrefs } = useAlertPreferences();
  const { data: schedules } = useIncomeSchedules();
  const { data: tokens } = useApiTokens();
  const { data: accounts } = useAccounts();
  const updateRecaps = useUpdateRecaps();
  const { biometricLockEnabled, setBiometricLockEnabled } = useAuth();

  const [recapsEnabled, setRecapsEnabled] = useState(true);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [sheet, setSheet] = useState<"profile" | "password" | "export" | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToastState] = useState<{ message: string; tone: "positive" | "negative" } | null>(null);
  const setToast = useCallback((message: string, tone: "positive" | "negative" = "positive") => setToastState({ message, tone }), []);
  const hideToast = useCallback(() => setToastState(null), []);

  useEffect(() => {
    if (profile) setRecapsEnabled(profile.recapsEnabled);
  }, [profile]);

  async function toggleRecaps(next: boolean) {
    setRecapsEnabled(next);
    try {
      await updateRecaps.mutateAsync(next);
    } catch {
      setRecapsEnabled(!next);
      setToast("Couldn't save that. Try again.", "negative");
    }
  }

  async function toggleBiometric(next: boolean) {
    if (next) {
      const [hasHardware, isEnrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (!hasHardware || !isEnrolled) {
        // Stays a system alert: the fix is in the phone's own settings, outside Tally.
        Alert.alert(
          "Set up Face ID / fingerprint first",
          "Your device doesn't have biometrics (or a passcode) set up yet. Add one in your device's system settings, then try again.",
        );
        return;
      }
    }
    setBiometricBusy(true);
    await setBiometricLockEnabled(next);
    setBiometricBusy(false);
  }

  function runExport(format: "csv" | "json") {
    setSheet(null);
    // The share sheet is a native modal too; wait for the picker to close.
    setTimeout(async () => {
      setExporting(true);
      try {
        await exportTransactions(format);
      } catch (err) {
        console.error(err);
        setToast("Couldn't export. Try again.", "negative");
      } finally {
        setExporting(false);
      }
    }, SHEET_CLOSE_MS);
  }

  if (isLoading || !profile) {
    return (
      <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
        <ScreenGlow />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  const alertsOn = alertPrefs ? Object.values(alertPrefs.channels).filter((c) => c.email).length : null;
  const bankCount = accounts?.institutions.length ?? 0;
  const initial = (profile.name || profile.email).trim().charAt(0).toUpperCase();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, gap: 22, paddingBottom: insets.bottom + 32 }}
      >
        <Pressable
          onPress={() => setSheet("profile")}
          accessibilityRole="button"
          accessibilityLabel={`${profile.name || "No name set"}, ${profile.email}. Edit profile`}
          className="flex-row items-center gap-3 bg-surface rounded-[16px] px-4 py-3.5 active:opacity-90"
        >
          <View className="items-center justify-center rounded-full bg-brand-subtle" style={{ width: 46, height: 46 }}>
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(17) }}>{initial}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} numberOfLines={1}>{profile.name || "No name set"}</Text>
            <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }} numberOfLines={1}>{profile.email}</Text>
          </View>
          <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>Edit</Text>
        </Pressable>

        <Group caption="Preferences">
          <Row first icon={(c) => <SunMoon size={15} color={c} strokeWidth={1.9} />} label="Appearance" right={<AppearanceSegments />} />
          <Row
            icon={(c) => <ScanFace size={15} color={c} strokeWidth={1.9} />}
            label="Require Face ID to open"
            right={<ThemedSwitch value={biometricLockEnabled} onValueChange={toggleBiometric} disabled={biometricBusy} label="Require Face ID or fingerprint to open Tally" />}
          />
        </Group>

        <Group caption="Notifications">
          <Row
            first
            icon={(c) => <Mail size={15} color={c} strokeWidth={1.9} />}
            label="Monthly recap email"
            right={<ThemedSwitch value={recapsEnabled} onValueChange={toggleRecaps} label="Monthly recap email" />}
          />
          <Row
            icon={(c) => <Bell size={15} color={c} strokeWidth={1.9} />}
            label="Alerts"
            value={alertsOn == null ? undefined : alertsOn === 0 ? "Off" : `${alertsOn} on`}
            onPress={() => router.push("/alerts")}
          />
        </Group>

        <Group caption="Data">
          <Row
            first
            icon={(c) => <Wallet size={15} color={c} strokeWidth={1.9} />}
            label="Income schedules"
            value={schedules ? String(schedules.schedules.length) : undefined}
            onPress={() => router.push("/income-schedules")}
          />
          <Row
            icon={(c) => <Download size={15} color={c} strokeWidth={1.9} />}
            label={exporting ? "Exporting…" : "Export transactions"}
            busy={exporting}
            onPress={() => setSheet("export")}
          />
          <Row
            icon={(c) => <KeyRound size={15} color={c} strokeWidth={1.9} />}
            label="API tokens"
            value={tokens ? String(tokens.keys.length) : undefined}
            onPress={() => router.push("/api-tokens")}
          />
        </Group>

        <Group caption="Account">
          <Row first icon={(c) => <Lock size={15} color={c} strokeWidth={1.9} />} label="Change password" onPress={() => setSheet("password")} />
          <Row
            icon={(c) => <Trash2 size={15} color={c} strokeWidth={1.9} />}
            label="Wipe all data"
            destructive
            onPress={() => setWipeOpen(true)}
            accessibilityHint="Opens a confirmation. Nothing is deleted yet."
          />
        </Group>

        <Pressable onPress={() => router.push("/changelog")} className="self-center py-1" accessibilityRole="link">
          <Text className="font-mono text-text-3" style={{ fontSize: rf(11.5) }}>v{APP_VERSION} · Changelog</Text>
        </Pressable>
      </ScrollView>

      <EditProfileSheet
        visible={sheet === "profile"}
        onClose={() => setSheet(null)}
        profile={profile}
        onSaved={() => {
          setSheet(null);
          setToast("Profile saved");
        }}
      />
      <PasswordSheet
        visible={sheet === "password"}
        onClose={() => setSheet(null)}
        onSaved={() => {
          setSheet(null);
          setToast("Password changed");
        }}
      />
      <SimplePickerSheet
        visible={sheet === "export"}
        onClose={() => setSheet(null)}
        title="Export transactions"
        items={[
          { id: "csv", label: "CSV", sublabel: "For spreadsheets like Numbers or Excel" },
          { id: "json", label: "JSON", sublabel: "For scripts and other apps" },
        ]}
        selectedId={null}
        onSelect={(id) => runExport(id as "csv" | "json")}
      />
      <WipeDialog
        visible={wipeOpen}
        onClose={() => setWipeOpen(false)}
        bankCount={bankCount}
        onWiped={() => {
          setWipeOpen(false);
          setToast("All data wiped");
        }}
      />

      <Toast message={toast?.message ?? null} tone={toast?.tone} onHidden={hideToast} bottom={insets.bottom + 16} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sheets and the wipe dialog
// ---------------------------------------------------------------------------

function EditProfileSheet({
  visible,
  onClose,
  profile,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  profile: { name: string | null; email: string; birthDate: string | null };
  onSaved: () => void;
}) {
  const updateProfile = useUpdateAccountProfile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fresh values every time it opens.
  useEffect(() => {
    if (!visible) return;
    setName(profile.name ?? "");
    setEmail(profile.email);
    setBirthDate(profile.birthDate ?? "");
    setPassword("");
    setError(null);
  }, [visible, profile]);

  const changed = name !== (profile.name ?? "") || email !== profile.email || birthDate !== (profile.birthDate ?? "");

  async function save() {
    setError(null);
    try {
      await updateProfile.mutateAsync({
        name: name.trim() || undefined,
        email: email.trim(),
        birthDate: birthDate.trim() || null,
        currentPassword: password,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your profile. Check your current password and try again."));
    }
  }

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      description="Saving needs your current password."
      onSubmit={save}
      submitLabel="Save profile"
      submitting={updateProfile.isPending}
      submitDisabled={!changed || !password}
      error={error}
    >
      <SheetField label="Name">
        <SheetInput value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" textContentType="name" />
      </SheetField>
      <SheetField label="Email">
        <SheetInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      </SheetField>
      <SheetField label="Birth date" hint="Optional. Lets the early-retirement planner show the age you'd reach it.">
        <SheetInput value={birthDate} onChangeText={setBirthDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      </SheetField>
      <SheetField label="Current password">
        <SheetInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" textContentType="password" />
      </SheetField>
    </FormSheet>
  );
}

function PasswordSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCurrent("");
    setNext("");
    setError(null);
  }, [visible]);

  const tooShort = next.length > 0 && next.length < 8;

  async function save() {
    setError(null);
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Couldn't change your password. Check your current password and try again."));
    }
  }

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Change password"
      onSubmit={save}
      submitLabel="Change password"
      submitting={changePassword.isPending}
      submitDisabled={!current || next.length < 8}
      error={error}
    >
      <SheetField label="Current password">
        <SheetInput value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" textContentType="password" />
      </SheetField>
      <View className="gap-1.5">
        <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>New password</Text>
        <SheetInput value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
        {/* Live, replacing the "Password too short" alert that only appeared after tapping Save. */}
        <Text className="font-ui" style={{ fontSize: rf(11.5), color: tooShort ? colors.negative : colors["text-3"] }}>
          At least 8 characters
        </Text>
      </View>
    </FormSheet>
  );
}

function WipeDialog({ visible, onClose, bankCount, onWiped }: { visible: boolean; onClose: () => void; bankCount: number; onWiped: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const wipeAccount = useWipeAccount();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPassword("");
    setError(null);
  }, [visible]);

  const banks = bankCount === 0 ? "every bank" : bankCount === 1 ? "your bank" : `all ${bankCount} banks`;

  async function wipe() {
    setError(null);
    try {
      await wipeAccount.mutateAsync({ currentPassword: password });
      onWiped();
    } catch (err) {
      setError(errorMessage(err, "Couldn't wipe your data. Nothing was deleted. Try again."));
    }
  }

  return (
    <TallyDialog
      visible={visible}
      onClose={onClose}
      dismissible={!wipeAccount.isPending}
      tone="negative"
      icon={<AlertTriangle size={20} color={colors.negative} strokeWidth={1.75} />}
      title="Wipe all data?"
      subtitle="This can't be undone"
      actions={[
        { label: "Wipe everything", onPress: wipe, variant: "danger", loading: wipeAccount.isPending, disabled: !password },
        { label: "Cancel", onPress: onClose, variant: "secondary", disabled: wipeAccount.isPending },
      ]}
    >
      <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
        Tally disconnects {banks} and deletes every account, transaction, balance and holding stored for them. Your login stays.
      </Text>
      <View className="gap-1.5">
        <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>Current password</Text>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          editable={!wipeAccount.isPending}
          placeholderTextColor={colors["text-3"]}
          accessibilityLabel="Current password"
          className="rounded-control bg-surface-2 px-[14px] font-ui text-text"
          style={{ height: 46, fontSize: rf(14.5), borderWidth: 1, borderColor: error ? colors.negative : "transparent" }}
        />
      </View>
      {error && <DialogError icon={<AlertTriangle size={16} color={colors.negative} strokeWidth={1.75} style={{ marginTop: 1 }} />}>{error}</DialogError>}
    </TallyDialog>
  );
}
