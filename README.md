# WALDI

WALDI (short for Waladi, meaning "my child" in Arabic) is a full-stack smart monitoring system designed to observe and track vital signs and environmental conditions in real-time. The system processes data from a Raspberry Pi module, stores it persistently, and presents it through a cross-platform mobile application.

## 🏗 System Architecture

The project is structured into two main components:

1. **Backend** (Node.js, Express, PostgreSQL / TimescaleDB)
2. **Frontend** (React Native, Expo)

A physical Raspberry Pi device (or simulator) acts as the data source, continuously broadcasting sensor readings over a Server-Sent Events (SSE) stream.

---

## 🛠 Features

- **Real-Time Vitals Tracking:** Monitors Heart Rate (BPM) and Breathing Rate (BPM).
- **Environmental Monitoring:** Tracks Room Temperature (°C), Room Humidity (%), and Body Temperature (°C).
- **Time-Series Data Storage:** Uses PostgreSQL combined with the TimescaleDB extension for hyper-efficient time-series data storage and querying.
- **Cross-Platform Mobile App:** Built with Expo & React Native for seamless iOS and Android support.
- **SSE Data Pipeline:** Relays live stream data from the Raspberry Pi straight through the Node backend to the mobile client in real-time.

---

## 📂 Project Structure

```text
WALDI/
├── backend/          # Node.js Express server acting as the data broker & API
│   ├── config.ts     # Environment variables for DB and Pi connectivity
│   ├── db.ts         # PostgreSQL/TimescaleDB connection and schema setup
│   ├── ingester.ts   # Connects to the Pi's SSE stream and writes to the DB
│   ├── server.ts     # Express REST API & SSE proxy for the mobile app
│   └── types.ts      # TypeScript interfaces for sensor payloads
└── frontend/         # React Native/Expo mobile application
    ├── src/          # Source code including hooks, UI components, & services
    ├── assets/       # Static assets (images, icons)
    └── App.tsx       # Main Entry point for the mobile app
```

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js** (v18+)
- **PostgreSQL** with **TimescaleDB** enabled.
- **Expo CLI** installed globally.

### 2. Database Setup

Ensure your local PostgreSQL instance is running. The backend expects a database (default: `sensors_db`).
TimescaleDB must be enabled on this database.

### 3. Backend Setup

Open a terminal and navigate to the backend directory:

```sh
cd backend
npm install
```

Create a `.env` file in the `backend` folder to match your setup:

```env
# Server
PORT=3000

# Raspberry Pi
PI_IP=172.20.10.2
PI_STREAM_URL=http://172.20.10.2:8000/stream

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=sensors_db
```

Start the backend server (this will automatically initialize the database table schemas):

```sh
npm run dev
```

### 4. Frontend Setup

Open a new terminal and navigate to the frontend directory:

```sh
cd frontend
npm install
```

**Important:** You must configure the frontend to connect to your computer's local network IP address (not `localhost`), since your physical device or emulator needs to reach your dev machine.
Edit the IP address in `frontend/src/services/backend/config.ts`:

```typescript
export const BACKEND_IP = "YOUR_COMPUTER_LAN_IP"; // e.g. 172.20.10.5
```

Start the Expo development server:

```sh
npx expo start
```

You can now scan the QR code with the Expo Go app on your phone, or run it in an iOS Simulator / Android Emulator.

---

## 📡 API Endpoints (Backend)

The Express server exposes the following endpoints:

- `GET /api/readings/latest` - Returns the most recent single sensor payload.
- `GET /api/readings` - Returns historical array of sensor data (supports `?from=`, `?to=`, `?limit=` query params).
- `GET /api/stream` - SSE stream directly forwarding live updates to connected mobile clients.

---

## 📝 License

This project is proprietary and for private use.
