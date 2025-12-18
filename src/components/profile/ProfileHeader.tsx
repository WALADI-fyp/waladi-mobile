import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";
import { BabyProfile } from "../../types/profile.types";

interface ProfileHeaderProps {
  profile: BabyProfile;
  onEditPress: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  onEditPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Avatar with camera icon */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={40} color={COLORS.primary} />
        </View>
        <View style={styles.cameraIconContainer}>
          <Ionicons name="camera" size={16} color={COLORS.white} />
        </View>
      </View>

      {/* Profile Info */}
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.age}>{profile.age}</Text>
      <Text style={styles.birthDate}>{profile.birthDate}</Text>

      {/* Edit Profile Button */}
      <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
        <Ionicons name="create-outline" size={18} color={COLORS.white} />
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: LAYOUT.spacing.lg,
    backgroundColor: COLORS.white,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: LAYOUT.spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightGray,
    borderWidth: 3,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  age: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  birthDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: LAYOUT.spacing.md,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: LAYOUT.spacing.lg,
    paddingVertical: LAYOUT.spacing.sm + 2,
    borderRadius: LAYOUT.borderRadius.sm,
  },
  editButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 6,
  },
});

export default ProfileHeader;
