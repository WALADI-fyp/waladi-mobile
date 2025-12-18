import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";

interface PulseViewProps {
  children: React.ReactNode;
  color: string;
}

const PulseView: React.FC<PulseViewProps> = ({ children, color }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulse,
          {
            backgroundColor: color,
            opacity: pulseAnim.interpolate({
              inputRange: [1, 1.3],
              outputRange: [0.3, 0],
            }),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  pulse: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});

export default PulseView;
