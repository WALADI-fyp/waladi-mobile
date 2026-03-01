import React from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Alert } from "react-native";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { COLORS, LAYOUT } from "../constants";
import { DUMMY_BABY_PROFILE } from "../constants/dummy-data";
import Header from "../components/common/Header";
import ProfileHeader from "../components/profile/ProfileHeader";
import SettingsItem from "../components/profile/SettingsItem";
import * as Haptics from "expo-haptics";
const ProfileScreen = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const handleEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Edit profile pressed");
  };

  const handleNotificationSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Notification settings pressed");
  };

  const handleAccountSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Account settings pressed");
  };

  const handleHelpSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log("Help & Support pressed");
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            console.error("Sign out error:", err);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Profile" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          profile={DUMMY_BABY_PROFILE}
          onEditPress={handleEditProfile}
        />

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <View style={styles.settingsList}>
            <SettingsItem
              title="Notification Settings"
              subtitle="Manage alerts"
              icon="notifications-outline"
              iconColor="#6C63FF"
              iconBackground="#EDE7F6"
              onPress={handleNotificationSettings}
            />
            <SettingsItem
              title="Account Settings"
              subtitle="Privacy & security"
              icon="person-outline"
              iconColor="#2196F3"
              iconBackground="#E3F2FD"
              onPress={handleAccountSettings}
            />
            <SettingsItem
              title="Help & Support"
              subtitle="FAQ & contact"
              icon="help-circle-outline"
              iconColor="#F44336"
              iconBackground="#FFEBEE"
              onPress={handleHelpSupport}
            />
            <SettingsItem
              title="Sign Out"
              subtitle={user?.emailAddresses?.[0]?.emailAddress || ""}
              icon="log-out-outline"
              iconColor="#F44336"
              iconBackground="#FFEBEE"
              onPress={handleSignOut}
              showBorder={false}
            />
          </View>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  settingsSection: {
    marginTop: LAYOUT.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.spacing.sm,
    paddingHorizontal: LAYOUT.spacing.md,
  },
  settingsList: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.borderRadius.md,
    marginHorizontal: LAYOUT.spacing.md,
    overflow: "hidden",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default ProfileScreen;
