import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { Stack } from "expo-router";
import { Card } from "@/components/ui/Card";
import { useApiTokens, useCreateApiToken, useDeleteApiToken, type ApiToken } from "@/lib/queries/apiTokens";
import { API_URL } from "@/lib/api";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { FormSheet, SheetField, SheetInput } from "@/components/ui/FormSheet";
import { HeaderTextAction } from "@/components/ui/HeaderTextAction";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function TokenRow({ token, isLast }: { token: ApiToken; isLast: boolean }) {
  const rf = useRF();
  const colors = useThemeColors();
  const del = useDeleteApiToken();

  function confirmRevoke() {
    Alert.alert(`Revoke "${token.name}"?`, "Anything still using it, like a Shortcut, will stop working immediately.", [
      { text: "Cancel", style: "cancel" },
      { text: "Revoke", style: "destructive", onPress: () => del.mutate(token.id) },
    ]);
  }

  return (
    <View
      className="flex-row items-center gap-3 py-3.5"
      style={!isLast ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
    >
      <View className="flex-1 gap-0.5 min-w-0">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>{token.name}</Text>
        <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }} numberOfLines={1}>
          {token.keyPrefix}··· · Created {formatDate(token.createdAt)}
          {token.lastUsedAt ? ` · Last used ${formatDate(token.lastUsedAt)}` : " · Never used"}
        </Text>
      </View>
      <Pressable onPress={confirmRevoke} disabled={del.isPending} hitSlop={8}>
        <Text className="font-ui-medium text-negative" style={{ fontSize: rf(13) }}>Revoke</Text>
      </Pressable>
    </View>
  );
}

// Native port of apps/web/components/settings/ApiKeysManager.tsx -- same API
// contract (lib/queries/apiTokens.ts), scoped down to what's actually
// actionable from a phone: create/list/revoke. Setup instructions for the
// Apple Shortcut stay on web (that's where you'd be reading them anyway
// while building the Shortcut on the same device or a Mac) but the revealed
// endpoint and token both need to be copyable from here too, so a phone-only
// user isn't blocked. Copy uses Text's built-in `selectable` (long-press ->
// native copy menu) rather than expo-clipboard, since that's a new native
// module this app doesn't already depend on and would need a fresh dev
// client build before it worked on-device.
export default function ApiTokensScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const { data, isLoading } = useApiTokens();
  const createToken = useCreateApiToken();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setError(null);
    try {
      const res = await createToken.mutateAsync(name.trim());
      setRevealedKey(res.key);
      setOpen(false);
      setName("");
    } catch {
      setError("Something went wrong");
    }
  }

  function openSheet() {
    setName("");
    setError(null);
    setOpen(true);
  }

  const endpoint = `${API_URL}/api/shortcuts/transactions`;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <Stack.Screen options={{ headerRight: () => <HeaderTextAction label="Add" onPress={openSheet} />, unstable_headerRightItems: () => [{ type: "custom", element: <HeaderTextAction label="Add" onPress={openSheet} />, hidesSharedBackground: true }] }} />
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}>
        <Card className="p-5 gap-2.5">
          <Text className="font-ui-semibold text-text-3" style={{ textTransform: "uppercase", fontSize: rf(12) }}>Endpoint</Text>
          <Text selectable className="font-mono text-text bg-surface-2 rounded-control px-3 py-2.5" style={{ fontSize: rf(12.5) }}>{endpoint}</Text>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
            For automations like Apple Shortcuts. Create a token with Add, tap and hold it or the endpoint above to copy, then send a
            POST with header Authorization: Bearer &lt;token&gt; and a JSON body of name, amount, card, and date (see web Settings
            for the full setup steps).
          </Text>
        </Card>

        {isLoading ? (
          <ActivityIndicator className="mt-4" />
        ) : (
          <>
            {revealedKey && (
              <Card className="p-5 gap-2.5" style={{ borderWidth: 1, borderColor: colors.warning }}>
                <Text className="font-ui text-text" style={{ fontSize: rf(13.5) }}>Copy this token now. It won&apos;t be shown again.</Text>
                <Text selectable className="font-mono text-text bg-surface-2 rounded-control px-3 py-2.5" style={{ fontSize: rf(12.5) }}>{revealedKey}</Text>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>Tap and hold the token to copy it.</Text>
                <Pressable onPress={() => setRevealedKey(null)} className="self-start">
                  <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>Done</Text>
                </Pressable>
              </Card>
            )}

            {(data?.keys.length ?? 0) > 0 && (
              <Card className="px-5">
                {data!.keys.map((k, i, arr) => (
                  <TokenRow key={k.id} token={k} isLast={i === arr.length - 1} />
                ))}
              </Card>
            )}

            {(data?.keys.length ?? 0) === 0 && (
              <Text className="font-ui text-text-3" style={{ fontSize: rf(13.5) }}>
                No tokens yet. Tap Add to create one for an automation like Apple Shortcuts.
              </Text>
            )}
          </>
        )}
      </ScrollView>
      <FormSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Create token"
        description="The token is shown once after you create it. Copy it somewhere safe."
        onSubmit={submit}
        submitLabel="Create token"
        submitting={createToken.isPending}
        submitDisabled={!name.trim()}
        error={error}
      >
        <SheetField label="Name" hint="So you can tell your tokens apart later.">
          <SheetInput value={name} onChangeText={setName} placeholder="e.g. Apple Shortcuts" autoFocus />
        </SheetField>
      </FormSheet>
    </View>
  );
}
