import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "../../constants";

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBackPress,
  rightIcon,
  onRightPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity onPress={onBackPress} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>

      <View style={styles.rightSection}>
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} style={styles.iconButton}>
            <Ionicons name={rightIcon} size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.spacing.md,
    paddingVertical: LAYOUT.spacing.md,
    backgroundColor: COLORS.white,
  },
  leftSection: {
    width: 40,
    alignItems: "flex-start",
  },
  rightSection: {
    width: 40,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
  },
  iconButton: {
    padding: LAYOUT.spacing.xs,
  },
});

export default Header;
