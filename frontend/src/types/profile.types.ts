export interface BabyProfile {
  id: string;
  name: string;
  age: string;
  birthDate: string;
  avatarUrl?: string;
}

export interface SettingsItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBackground: string;
  onPress: () => void;
}