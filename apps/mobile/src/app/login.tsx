import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "@/lib/AuthContext";
import { ApiError, NetworkError } from "@/lib/api";
import { useThemeColors } from "@/theme/useThemeColors";

// MOBILE_DESIGN.md §5.1 -- centered form, filled (borderless) inputs, full
// pill primary button, no sign-up flow (single-user personal app).
function TallyMark({ color }: { color: string }) {
  return (
    <Svg width={36} height={36} viewBox="0 0 34 34" fill="none">
      <Path d="M6 6V28" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path d="M12.7 6V28" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path d="M19.4 6V28" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path d="M26.1 6V28" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path d="M3.5 22L28.5 12" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
    </Svg>
  );
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError || err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-canvas">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-3 mb-16">
          <TallyMark color={colors.brand} />
          <Text className="font-display text-[32px] text-text">Tally</Text>
        </View>

        <View className="gap-3.5">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors["text-3"]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            className="h-14 rounded-control bg-surface-2 px-[18px] text-[15.5px] font-ui text-text"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors["text-3"]}
            secureTextEntry
            className="h-14 rounded-control bg-surface-2 px-[18px] text-[15.5px] font-ui text-text"
          />

          {error && <Text className="font-ui text-[13.5px] text-negative px-1">{error}</Text>}

          <Pressable
            onPress={handleLogin}
            disabled={loading || !email || !password}
            className="h-14 rounded-full bg-brand items-center justify-center mt-2 active:opacity-90 disabled:opacity-40"
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-[15.5px] font-ui-semibold text-on-brand">Log in</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
