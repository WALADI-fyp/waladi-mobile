import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../constants";
import { DUMMY_ALERTS } from "../constants/dummy-data";
import Header from "../components/common/Header";
import AlertItem from "../components/alerts/AlertItem";
import { Alert as AlertType } from "../types/alert.types";
import * as Haptics from "expo-haptics";

type FilterType = "all" | "critical" | "warning" | "info";

const AlertsScreen = () => {
  const [alerts, setAlerts] = useState<AlertType[]>(DUMMY_ALERTS);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = alerts.filter((a) => a.status === "unread").length;

  const filteredAlerts = alerts.filter((alert) => {
    if (activeFilter === "all") return true;
    return alert.severity === activeFilter;
  });

  const handleAlertPress = (alert: AlertType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Mark as read
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, status: "read" as const } : a))
    );
    console.log("Alert pressed:", alert.title);
  };

  const handleDismiss = (alert: AlertType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
  };

  const handleMarkAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAlerts((prev) => prev.map((a) => ({ ...a, status: "read" as const })));
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAlerts([]);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate fetching new alerts
    setTimeout(() => {
      setAlerts(DUMMY_ALERTS);
      setRefreshing(false);
    }, 1000);
  }, []);

  const FilterButton = ({
    filter,
    label,
    count,
  }: {
    filter: FilterType;
    label: string;
    count?: number;
  }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === filter && styles.filterButtonActive,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveFilter(filter);
      }}
    >
      <Text
        style={[
          styles.filterText,
          activeFilter === filter && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          style={[
            styles.filterBadge,
            activeFilter === filter && styles.filterBadgeActive,
          ]}
        >
          <Text
            style={[
              styles.filterBadgeText,
              activeFilter === filter && styles.filterBadgeTextActive,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Header right component
  const HeaderRight = (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={handleMarkAllRead}
      disabled={unreadCount === 0}
    >
      <Ionicons
        name="checkmark-done-outline"
        size={22}
        color={unreadCount > 0 ? COLORS.primary : COLORS.gray}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Alerts" rightComponent={HeaderRight} />

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: "#FFEBEE" }]}>
            <Ionicons name="alert-circle" size={20} color={COLORS.error} />
          </View>
          <Text style={styles.summaryCount}>
            {alerts.filter((a) => a.severity === "critical").length}
          </Text>
          <Text style={styles.summaryLabel}>Critical</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="warning" size={20} color={COLORS.warning} />
          </View>
          <Text style={styles.summaryCount}>
            {alerts.filter((a) => a.severity === "warning").length}
          </Text>
          <Text style={styles.summaryLabel}>Warnings</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: "#E3F2FD" }]}>
            <Ionicons name="notifications" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryCount}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <FilterButton filter="all" label="All" count={alerts.length} />
          <FilterButton
            filter="critical"
            label="Critical"
            count={alerts.filter((a) => a.severity === "critical").length}
          />
          <FilterButton
            filter="warning"
            label="Warning"
            count={alerts.filter((a) => a.severity === "warning").length}
          />
          <FilterButton
            filter="info"
            label="Info"
            count={alerts.filter((a) => a.severity === "info").length}
          />
        </ScrollView>
      </View>

      {/* Alerts List */}
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {filteredAlerts.length > 0 ? (
            <>
              {/* Today's Alerts */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent</Text>
                {alerts.length > 0 && (
                  <TouchableOpacity onPress={handleClearAll}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {filteredAlerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onPress={handleAlertPress}
                  onDismiss={handleDismiss}
                />
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-off-outline"
                  size={48}
                  color={COLORS.gray}
                />
              </View>
              <Text style={styles.emptyTitle}>No Alerts</Text>
              <Text style={styles.emptyMessage}>
                {activeFilter === "all"
                  ? "You're all caught up! No alerts to display."
                  : `No ${activeFilter} alerts at this time.`}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    padding: LAYOUT.spacing.xs,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    marginHorizontal: LAYOUT.spacing.md,
    marginTop: LAYOUT.spacing.sm,
    marginBottom: LAYOUT.spacing.md,
    padding: LAYOUT.spacing.md,
    borderRadius: LAYOUT.borderRadius.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.xs,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.lightGray,
    marginVertical: LAYOUT.spacing.xs,
  },
  filterContainer: {
    marginBottom: LAYOUT.spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: LAYOUT.spacing.md,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.sm,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    marginRight: LAYOUT.spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  filterBadge: {
    marginLeft: 6,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterBadgeTextActive: {
    color: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: LAYOUT.spacing.md,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  clearText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: LAYOUT.spacing.xl * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: LAYOUT.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.spacing.xs,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: LAYOUT.spacing.xl,
  },
});

export default AlertsScreen;
