import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useExpense } from "@/lib/expense-context";
import Animated, { FadeInUp } from "react-native-reanimated";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function formatDate(value: Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, categories, deleteTransaction, loadingTransactions } =
    useExpense();

  const transactionId = Number(id);
  const transaction = transactions.find((t) => t.id === transactionId);

  // Loading / not-found states — the transaction list may still be fetching,
  // or the id may not resolve (e.g. deep-linked to a deleted transaction).
  if (!transaction) {
    return (
      <ScreenContainer
        className="flex-1 bg-background"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-row items-center px-6 pt-6 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Go back"
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name={loadingTransactions ? "hourglass-outline" : "search-outline"}
            size={32}
            color={colors.muted}
          />
          <Text className="mt-3 text-muted font-medium text-sm">
            {loadingTransactions
              ? "Loading transaction…"
              : "Transaction not found"}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const isIncome = transaction.type === "income";
  const accent = isIncome ? colors.success : colors.error;
  const category = categories.find((c) => c.id === transaction.categoryId);

  const handleDelete = () => {
    const remove = async () => {
      await deleteTransaction(transaction.id);
      router.back();
    };

    if (Platform.OS === "web") {
      // Alert.alert buttons are no-ops on web; use confirm for a real prompt.
      if (window.confirm("Delete this transaction? This cannot be undone.")) {
        void remove();
      }
      return;
    }

    Alert.alert(
      "Delete transaction",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void remove() },
      ],
      { cancelable: true },
    );
  };

  return (
    <ScreenContainer
      className="flex-1 bg-background"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Go back"
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text className="text-h1 text-foreground">Details</Text>
          <Pressable
            onPress={handleDelete}
            hitSlop={8}
            accessibilityLabel="Delete transaction"
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.error + "14" }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        </View>

        {/* Amount */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          className="items-center mt-6 px-6"
        >
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: accent + "18" }}
          >
            <Ionicons
              name={isIncome ? "arrow-down" : "arrow-up"}
              size={26}
              color={accent}
            />
          </View>
          <Text className="text-4xl font-bold" style={{ color: accent }}>
            {isIncome ? "+" : "-"}${transaction.amount}
          </Text>
          <Text className="mt-xs text-sm text-muted font-medium capitalize">
            {transaction.type}
          </Text>
        </Animated.View>

        {/* Details card */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(400)}
          className="mx-6 mt-8 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          {/* Category */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <Text className="text-sm font-medium text-muted">Category</Text>
            <View className="flex-row items-center gap-2">
              {category && (
                <View
                  className="w-6 h-6 rounded-full items-center justify-center"
                  style={{ backgroundColor: category.color }}
                >
                  <Ionicons
                    name={(category.icon as IoniconName) ?? "pricetag"}
                    size={13}
                    color="white"
                  />
                </View>
              )}
              <Text className="text-sm font-semibold text-foreground">
                {category?.name ?? "Uncategorized"}
              </Text>
            </View>
          </View>

          <View style={{ height: 0.5, backgroundColor: colors.border }} />

          {/* Date */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <Text className="text-sm font-medium text-muted">Date</Text>
            <Text className="text-sm font-semibold text-foreground">
              {formatDate(transaction.date)}
            </Text>
          </View>

          {transaction.description ? (
            <>
              <View style={{ height: 0.5, backgroundColor: colors.border }} />
              {/* Description */}
              <View className="px-5 py-4">
                <Text className="text-sm font-medium text-muted mb-1.5">
                  Description
                </Text>
                <Text className="text-sm text-foreground leading-5">
                  {transaction.description}
                </Text>
              </View>
            </>
          ) : null}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}
