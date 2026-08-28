import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Wallet, TrendingUp, LineChart, Settings, LogOut, ChevronRight } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";

function Row({ icon, label, onPress, destructive }: { icon: React.ReactNode; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between py-4 active:opacity-70">
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="font-ui-medium text-[15px]" style={{ color: destructive ? "#B23A2C" : "#1A1917" }}>
          {label}
        </Text>
      </View>
      {!destructive && <ChevronRight size={16} color="#948F84" />}
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  return (
    <View className="flex-1 bg-canvas px-5 pt-4">
      {user && <Text className="font-ui text-[13px] text-text-2 mb-2">{user.email}</Text>}

      <View style={{ borderTopWidth: 1, borderTopColor: "#E4E1D9" }}>
        <Row icon={<LineChart size={20} color="#524F47" strokeWidth={1.75} />} label="Investments" onPress={() => router.push("/investments")} />
        <View style={{ borderTopWidth: 1, borderTopColor: "rgba(228,225,217,0.55)" }}>
          <Row icon={<TrendingUp size={20} color="#524F47" strokeWidth={1.75} />} label="FIRE calculator" onPress={() => router.push("/fire")} />
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: "rgba(228,225,217,0.55)" }}>
          <Row icon={<Wallet size={20} color="#524F47" strokeWidth={1.75} />} label="Subscriptions" onPress={() => router.push("/subscriptions")} />
        </View>
      </View>

      <View className="mt-6" style={{ borderTopWidth: 1, borderTopColor: "#E4E1D9" }}>
        <Row icon={<Settings size={20} color="#524F47" strokeWidth={1.75} />} label="Settings" onPress={() => router.push("/settings")} />
        <View style={{ borderTopWidth: 1, borderTopColor: "rgba(228,225,217,0.55)" }}>
          <Row icon={<LogOut size={20} color="#B23A2C" strokeWidth={1.75} />} label="Log out" destructive onPress={() => logout()} />
        </View>
      </View>
    </View>
  );
}
