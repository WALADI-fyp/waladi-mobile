import * as MediaLibrary from "expo-media-library";
import { Audio } from "expo-av";
import { captureRef } from "react-native-view-shot";
import { Alert, Platform, Linking } from "react-native";

export class MediaService {
  private static talkBackRecording: Audio.Recording | null = null;
  private static isTalking = false;
  private static isRecording = false;

  // Request permissions
  static async requestPermissions() {
    try {
      // Request media library permission
      const mediaPermission = await MediaLibrary.requestPermissionsAsync();

      // Request audio permission
      const audioPermission = await Audio.requestPermissionsAsync();

      if (!mediaPermission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to save snapshots."
        );
        return false;
      }

      if (!audioPermission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your microphone for audio features."
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  }

  // Take snapshot
  static async takeSnapshot(viewRef: any): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;

      // Capture the view
      const uri = await captureRef(viewRef, {
        format: "jpg",
        quality: 0.8,
      });

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(uri);

      // Try to create album, or add to existing one
      try {
        await MediaLibrary.createAlbumAsync("WALADI", asset, false);
      } catch (e) {
        const albums = await MediaLibrary.getAlbumsAsync();
        const waladiAlbum = albums.find((album) => album.title === "WALADI");
        if (waladiAlbum) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], waladiAlbum, false);
        }
      }

      Alert.alert("Success", "Snapshot saved to your photo library!", [
        { text: "OK" },
      ]);

      return true;
    } catch (error) {
      console.error("Error taking snapshot:", error);
      Alert.alert("Error", "Failed to take snapshot. Please try again.", [
        { text: "OK" },
      ]);
      return false;
    }
  }

  // Start screen recording with clear instructions
  static async startScreenRecording(): Promise<boolean> {
    try {
      if (this.isRecording) {
        Alert.alert("Already Recording", "Screen recording is already in progress.");
        return true;
      }

      if (Platform.OS === "ios") {
        Alert.alert(
          "Start Screen Recording",
          "To record the baby monitor stream:\n\n1. Swipe down from top-right corner to open Control Center\n2. Press and HOLD the Record button (⦿)\n3. Tap 'WALADI' from the list\n4. Tap 'Start Recording'\n\nThe recording will begin after a 3-second countdown.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Control Center",
              onPress: () => {
                this.isRecording = true;
                // On iOS, we can't programmatically open Control Center
                // But we mark as recording so UI updates
                Alert.alert(
                  "Ready to Record",
                  "Open Control Center now to start recording.",
                  [{ text: "OK" }]
                );
              },
            },
          ]
        );
      } else {
        // Android
        Alert.alert(
          "Screen Recording",
          "To record:\n\n1. Pull down notification shade\n2. Tap 'Screen Record'\n3. Select 'WALADI'\n4. Tap 'Start'\n\nThe recording will be saved to your gallery.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Got it",
              onPress: () => {
                this.isRecording = true;
              },
            },
          ]
        );
      }

      return true;
    } catch (error) {
      console.error("Error starting screen recording:", error);
      return false;
    }
  }

  // Stop screen recording
  static async stopScreenRecording(): Promise<boolean> {
    try {
      if (!this.isRecording) {
        return true;
      }

      if (Platform.OS === "ios") {
        Alert.alert(
          "Stop Screen Recording",
          "To stop:\n\n1. Tap the red status bar at the top\n2. Tap 'Stop'\n\nOR\n\n1. Open Control Center\n2. Tap the Record button\n\nThe video will be saved to your Photos app.",
          [
            {
              text: "OK",
              onPress: () => {
                this.isRecording = false;
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Stop Recording",
          "Pull down the notification shade and tap 'Stop' on the screen recording notification.\n\nThe video will be in your gallery.",
          [
            {
              text: "OK",
              onPress: () => {
                this.isRecording = false;
              },
            },
          ]
        );
      }

      return true;
    } catch (error) {
      console.error("Error stopping screen recording:", error);
      return false;
    }
  }

  // Start talk back - COMPLETELY REWRITTEN
  static async startTalkBack(): Promise<boolean> {
    try {
      // First, completely stop any existing recording
      await this.forceStopTalkBack();

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;

      console.log("Setting up audio mode...");
      
      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log("Creating new recording...");
      
      // Create brand new recording instance
      const recording = new Audio.Recording();

      console.log("Preparing recording...");
      
      // Prepare
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      console.log("Starting recording...");
      
      // Start
      await recording.startAsync();

      console.log("Recording started, updating state...");
      
      // Only update state after everything succeeds
      this.talkBackRecording = recording;
      this.isTalking = true;

      console.log("Talk back active!");
      return true;
    } catch (error) {
      console.error("Error in startTalkBack:", error);

      // Complete cleanup
      await this.forceStopTalkBack();

      Alert.alert("Error", "Failed to start talk back. Please try again.", [
        { text: "OK" },
      ]);
      return false;
    }
  }

  // Force stop talk back - helper method
  private static async forceStopTalkBack() {
    try {
      if (this.talkBackRecording) {
        try {
          const status = await this.talkBackRecording.getStatusAsync();
          if (status.isRecording || status.isDoneRecording) {
            await this.talkBackRecording.stopAndUnloadAsync();
          }
        } catch (e) {
          console.log("Force cleanup recording");
        }
        this.talkBackRecording = null;
      }

      this.isTalking = false;

      // Reset audio mode
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
        });
      } catch (e) {
        console.log("Audio mode reset skipped");
      }
    } catch (error) {
      console.log("Force stop error (non-critical):", error);
    }
  }

  // Stop talk back
  static async stopTalkBack(): Promise<boolean> {
    try {
      console.log("Stopping talk back...");
      
      if (!this.isTalking) {
        console.log("Not currently talking");
        return true;
      }

      await this.forceStopTalkBack();
      
      console.log("Talk back stopped successfully");
      return true;
    } catch (error) {
      console.error("Error stopping talk back:", error);
      
      // Force cleanup anyway
      await this.forceStopTalkBack();
      
      return true;
    }
  }

  // Get status
  static getStatus() {
    return {
      isRecording: this.isRecording,
      isTalking: this.isTalking,
    };
  }

  // Cleanup method
  static async cleanup() {
    if (this.isRecording) {
      this.isRecording = false;
    }
    if (this.isTalking) {
      await this.stopTalkBack();
    }
  }
}