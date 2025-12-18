import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";

interface SettingsItemProps {
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBackground: string;
  onPress: () => void;
  showBorder?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  icon,
  iconColor,
  iconBackground,
  onPress,
  showBorder = true,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, !showBorder && styles.noBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leftContent}>
        <View
          style={[styles.iconContainer, { backgroundColor: iconBackground }]}
        >
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={iconColor}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: LAYOUT.spacing.md,
    paddingHorizontal: LAYOUT.spacing.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: LAYOUT.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: LAYOUT.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});

export default SettingsItem;
