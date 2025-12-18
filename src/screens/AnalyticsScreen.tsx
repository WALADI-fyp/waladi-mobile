import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

const AnalyticsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Analytics Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    color: COLORS.textPrimary,
  },
});

export default AnalyticsScreen;