# WALADI Notification Implementation

## Goal
Enable reliable cry notifications when the app is foregrounded, backgrounded, or closed.

## Why this was needed
Local in-app notifications triggered from MQTT only work while app JavaScript is active.
For iOS background or terminated delivery, we need server-side push.

## Final architecture
1. Device pipeline writes cry sessions into `cry_alerts` (with `started_at`, `ended_at`, optional duration/probability fields).
2. Backend polls `cry_alerts` for new start/end events.
3. Backend sends Expo push notifications to registered user push tokens.
4. Frontend registers its Expo push token to backend after permission/auth.

## Backend changes

### 1) Push token storage and registration API
File: `backend/server.ts`

- Added table bootstrap:
  - `user_push_tokens`
  - columns: `user_id`, `expo_push_token`, `platform`, `device_id`, `enabled`, timestamps
- Added authenticated endpoint:
  - `POST /api/notifications/expo-token`
  - body:
    - `expo_push_token`
    - `platform` (optional)
    - `device_id` (optional)
  - upserts token and marks it enabled.

### 2) Cry push sender service
File: `backend/cryPushNotifications.ts`

- Polls `cry_alerts` every 5 seconds.
- Tracks session state in memory to avoid duplicate start/end sends.
- Resolves notification recipients via:
  - row `user_id` if present, else
  - `user_devices` by `device_id`.
- Fetches enabled Expo tokens from `user_push_tokens`.
- Sends push through Expo HTTP API:
  - `https://exp.host/--/api/v2/push/send`
- Message behavior:
  - start event title: `Crying detected`
  - end event title: `Crying detected (<duration>s)`
  - body includes probability text if available.

### 3) Service startup
File: `backend/index.ts`

- Imports `startCryPushNotifications`.
- Starts notifier alongside API startup.

## Frontend changes

### 1) Token registration endpoint config
File: `frontend/src/services/backend/config.ts`

- Added:
  - `EXPO_PUSH_TOKEN_URL = ${BACKEND_URL}/api/notifications/expo-token`

### 2) Push registration hook
File: `frontend/src/hooks/useCryAlertNotifications.ts`

- Sets notification foreground handler.
- Requests notification permissions.
- Retrieves Expo push token (`getExpoPushTokenAsync`).
- Registers token to backend with Clerk bearer token.
- Adds token refresh listener (`addPushTokenListener`) and re-syncs automatically.

### 3) Hook placement under Clerk context
File: `frontend/App.tsx`

- Moved hook usage into `AppContent` (child of `ClerkProvider`) so `useAuth()` works correctly.

## Alert UI text updates (related)
File: `frontend/src/screens/AlertsScreen.tsx`
File: `frontend/src/components/alerts/AlertItem.tsx`

- Card timestamp display changed to 12-hour format with seconds.
- Full message wrapping enabled (no `...` truncation).
- Duration removed from message body and kept in title:
  - `Crying detected (<duration>s)`

## How to verify

1. Sign in on app.
2. Grant notification permissions.
3. Check frontend logs for:
   - `Expo token acquired`
   - `Expo token registered to backend`
4. Confirm backend has token row in `user_push_tokens`.
5. Trigger cry start/end and verify push arrives with expected title/body.

## Troubleshooting

1. No background notifications:
   - ensure token exists in `user_push_tokens`
   - ensure backend logs show no `[push]` API errors
   - ensure iOS app notification settings are enabled
2. Duplicates:
   - backend tracks sent start/end sessions in memory to suppress duplicates
3. Works foreground but not closed:
   - verify backend service is running and deployed build is current

## Notes

- This implementation uses Expo Push Service.
- Push reliability depends on APNs/Expo delivery and valid credentials.
- Expo recommends testing push with a development build for consistent behavior.
