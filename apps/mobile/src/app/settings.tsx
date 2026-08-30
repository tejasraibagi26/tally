import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { ChevronRight, Link2, Sun, Moon, Smartphone, Pencil, Lock, Trash2, Check, X } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { useAccountProfile, useUpdateAccountProfile, useUpdateRecaps, useChangePassword, useWipeAccount } from "@/lib/queries/account";
import { ApiError } from "@/lib/api";
import { useThemeColors } from "@/theme/useThemeColors";
import { type AppearanceMode, getStoredAppearanceMode, storeAppearanceMode } from "@/theme/appearance";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useRF } from "@/theme/responsiveFont";

const APPEARANCE_OPTIONS: { mode: AppearanceMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Smartphone },
];

function AppearancePicker() {
  const colors = useThemeColors();
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
    <View className="flex-row gap-2">
      {APPEARANCE_OPTIONS.map(({ mode, label, Icon }) => {
        const active = selected === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => choose(mode)}
            className={`flex-1 items-center gap-1.5 py-3 rounded-control ${active ? "bg-brand-subtle" : "bg-surface-2"}`}
          >
            <Icon size={18} color={active ? colors.brand : colors["text-2"]} strokeWidth={1.9} />
            <Text className={`font-ui-medium ${active ? "text-brand" : "text-text-2"}`} style={{ fontSize: rf(12.5) }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, secure, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: "email-address" | "default";
}) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="gap-1.5">
      <Text className="font-ui-medium text-text-2" style={{ textTransform: "uppercase", fontSize: rf(12) }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors["text-3"]}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize="none"
        className="h-12 rounded-control bg-surface-2 px-[14px] font-ui text-text"
        style={{ fontSize: rf(14.5) }}
      />
    </View>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  return fallback;
}

// MOBILE_DESIGN.md-style settings surface, scoped to what's genuinely useful
// on mobile v1: profile edit, password change, a link out to the Accounts
// tab for connections, and the wipe-data danger zone. Categories/Rules/
// Export are web-first workflows (bulk editing, file downloads) deferred
// for now rather than half-ported.
export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const contentTop = useScreenContentTop();
  const rf = useRF();
  const { data: profile, isLoading } = useAccountProfile();
  const updateProfile = useUpdateAccountProfile();
  const updateRecaps = useUpdateRecaps();
  const changePassword = useChangePassword();
  const wipeAccount = useWipeAccount();

  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [recapsEnabled, setRecapsEnabled] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setEmail(profile.email);
    setBirthDate(profile.birthDate ?? "");
    setRecapsEnabled(profile.recapsEnabled);
  }, [profile]);

  async function toggleRecaps(next: boolean) {
    setRecapsEnabled(next);
    try {
      await updateRecaps.mutateAsync(next);
    } catch {
      setRecapsEnabled(!next);
    }
  }

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const [wiping, setWiping] = useState(false);
  const [wipePassword, setWipePassword] = useState("");

  async function saveProfile() {
    try {
      await updateProfile.mutateAsync({
        name: name.trim() || undefined,
        email: email.trim(),
        birthDate: birthDate.trim() || null,
        currentPassword: profilePassword,
      });
      setEditingProfile(false);
      setProfilePassword("");
    } catch (err) {
      Alert.alert("Couldn't save", errorMessage(err, "Check your current password and try again."));
    }
  }

  async function savePassword() {
    if (newPw.length < 8) {
      Alert.alert("Password too short", "New password must be at least 8 characters.");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: currentPw, newPassword: newPw });
      setChangingPassword(false);
      setCurrentPw("");
      setNewPw("");
      Alert.alert("Password changed");
    } catch (err) {
      Alert.alert("Couldn't change password", errorMessage(err, "Check your current password and try again."));
    }
  }

  function confirmWipe() {
    Alert.alert("Wipe all data?", "This disconnects every institution and permanently deletes all synced financial data. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Wipe everything",
        style: "destructive",
        onPress: async () => {
          try {
            await wipeAccount.mutateAsync({ currentPassword: wipePassword });
            setWiping(false);
            setWipePassword("");
            Alert.alert("Data wiped", "All accounts and transactions have been removed.");
          } catch (err) {
            Alert.alert("Couldn't wipe data", errorMessage(err, "Check your current password and try again."));
          }
        },
      },
    ]);
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

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
    <ScreenGlow />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 20, gap: 24, paddingBottom: 40 }}>
      {/* Profile */}
      <View className="gap-3">
        <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(13) }}>
          Profile
        </Text>
        <Card className="p-5 gap-4">
          {editingProfile ? (
            <>
              <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Field label="Birth date" value={birthDate} onChangeText={setBirthDate} placeholder="YYYY-MM-DD" />
              <Field label="Current password" value={profilePassword} onChangeText={setProfilePassword} secure />
              <View className="flex-row gap-3 pt-1">
                <Pressable
                  onPress={() => {
                    setEditingProfile(false);
                    setProfilePassword("");
                    setName(profile.name ?? "");
                    setEmail(profile.email);
                    setBirthDate(profile.birthDate ?? "");
                  }}
                  className="flex-1 h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-surface-2"
                >
                  <X size={15} color={colors["text-2"]} strokeWidth={2} />
                  <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveProfile}
                  disabled={updateProfile.isPending || !profilePassword}
                  className="flex-1 h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-brand disabled:opacity-50"
                >
                  {updateProfile.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={15} color="#FFFFFF" strokeWidth={2.5} />
                      <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Save</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View className="gap-1">
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{profile.name || "No name set"}</Text>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>{profile.email}</Text>
                {profile.birthDate && <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>Born {profile.birthDate}</Text>}
              </View>
              <Pressable onPress={() => setEditingProfile(true)} className="h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-surface-2">
                <Pencil size={14} color={colors.text} strokeWidth={2} />
                <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }}>Edit profile</Text>
              </Pressable>
            </>
          )}
        </Card>
      </View>

      {/* Appearance */}
      <View className="gap-3">
        <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(13) }}>
          Appearance
        </Text>
        <Card className="p-3">
          <AppearancePicker />
        </Card>
      </View>

      {/* Notifications */}
      <View className="gap-3">
        <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(13) }}>
          Notifications
        </Text>
        <Card className="p-5">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>Monthly recap email</Text>
              <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
                A summary of income, spend, budgets, and net worth on the 1st of each month.
              </Text>
            </View>
            <Switch value={recapsEnabled} onValueChange={toggleRecaps} trackColor={{ true: colors.brand }} />
          </View>
        </Card>
      </View>

      {/* Password */}
      <View className="gap-3">
        <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(13) }}>
          Password
        </Text>
        <Card className="p-5 gap-4">
          {changingPassword ? (
            <>
              <Field label="Current password" value={currentPw} onChangeText={setCurrentPw} secure />
              <Field label="New password" value={newPw} onChangeText={setNewPw} secure />
              <View className="flex-row gap-3 pt-1">
                <Pressable
                  onPress={() => {
                    setChangingPassword(false);
                    setCurrentPw("");
                    setNewPw("");
                  }}
                  className="flex-1 h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-surface-2"
                >
                  <X size={15} color={colors["text-2"]} strokeWidth={2} />
                  <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={savePassword}
                  disabled={changePassword.isPending || !currentPw || !newPw}
                  className="flex-1 h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-brand disabled:opacity-50"
                >
                  {changePassword.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={15} color="#FFFFFF" strokeWidth={2.5} />
                      <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Change</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setChangingPassword(true)} className="h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-surface-2">
              <Lock size={14} color={colors.text} strokeWidth={2} />
              <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }}>Change password</Text>
            </Pressable>
          )}
        </Card>
      </View>

      {/* Connections */}
      <View className="gap-3">
        <Text className="font-ui-semibold text-text-2" style={{ textTransform: "uppercase", fontSize: rf(13) }}>
          Data
        </Text>
        <Card className="px-5">
          <Pressable onPress={() => router.push("/(tabs)/accounts")} className="flex-row items-center gap-3 py-4">
            <Link2 size={18} color={colors["text-2"]} strokeWidth={1.75} />
            <Text className="flex-1 font-ui-medium text-text" style={{ fontSize: rf(14.5) }}>Accounts & connections</Text>
            <ChevronRight size={16} color={colors["text-3"]} />
          </Pressable>
        </Card>
      </View>

      {/* Danger zone */}
      <View className="gap-3">
        <Text className="font-ui-semibold text-negative" style={{ textTransform: "uppercase", fontSize: rf(13) }}>
          Danger zone
        </Text>
        <Card className="p-5 gap-4" style={{ borderWidth: 1, borderColor: colors.negative }}>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5) }}>
            Disconnects every institution and permanently deletes all synced financial data.
          </Text>
          {wiping ? (
            <>
              <Field label="Current password" value={wipePassword} onChangeText={setWipePassword} secure />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setWiping(false);
                    setWipePassword("");
                  }}
                  className="flex-1 h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-surface-2"
                >
                  <X size={15} color={colors["text-2"]} strokeWidth={2} />
                  <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmWipe}
                  disabled={wipeAccount.isPending || !wipePassword}
                  className="flex-1 h-11 rounded-full flex-row items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ backgroundColor: colors.negative }}
                >
                  {wipeAccount.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Trash2 size={14} color="#FFFFFF" strokeWidth={2} />
                      <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Wipe data</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setWiping(true)} className="h-11 rounded-full flex-row items-center justify-center gap-1.5 bg-negative-subtle">
              <Trash2 size={14} color={colors.negative} strokeWidth={2} />
              <Text className="font-ui-semibold text-negative" style={{ fontSize: rf(14) }}>Wipe all data</Text>
            </Pressable>
          )}
        </Card>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}
