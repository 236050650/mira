import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useAppTheme } from "@/lib/theme-context";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const { theme } = useAppTheme();
  return (
    <Text style={{ fontSize: 18, color: focused ? theme.primary : theme.muted2 }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { theme } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted2,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "发现",
          tabBarIcon: ({ focused }) => <TabIcon label="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "消息",
          tabBarIcon: ({ focused }) => <TabIcon label="…" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "我的",
          tabBarIcon: ({ focused }) => <TabIcon label="我" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
