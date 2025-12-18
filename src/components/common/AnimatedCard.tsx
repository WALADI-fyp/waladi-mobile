import React, { useEffect } from "react";
import { StyleSheet, Animated, Pressable } from "react-native";
import { COLORS, LAYOUT } from "../../constants";

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  onPress?: () => void;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  delay = 0,
  onPress,
}) => {
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  const scaleAnim = new Animated.Value(1);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={animatedStyle}>{children}</Animated.View>
      </Pressable>
    );
  }

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default AnimatedCard;
