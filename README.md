# ColdChainRx

> A permissioned Hyperledger Fabric platform fusing IoT temperature telemetry, ML anomaly detection, and consumer-facing QR verification for pharmaceutical cold chains.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Team & Subsystem Ownership](#team--subsystem-ownership)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Step-by-Step Tutorial to Run](#step-by-step-tutorial-to-run)
  - [1. Backend API Server](#1-backend-api-server)
  - [2. Frontend Consumer QR Verification Portal](#2-frontend-consumer-qr-verification-portal)
  - [3. Machine Learning Microservice](#3-machine-learning-microservice)
  - [4. IoT Edge Gateway & Smart Contracts](#4-iot-edge-gateway--smart-contracts)
- [API Reference & Testing](#api-reference--testing)
- [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 🚀 Overview

**ColdChainRx** provides end-to-end traceability and authenticity verification for temperature-sensitive pharmaceuticals (such as vaccines). It combines real-time IoT temperature logging, an Isolation Forest machine learning model for detecting thermal breaches, and Hyperledger Fabric blockchain for immutable record-keeping. Consumers and supply chain stakeholders can verify batch status by scanning dynamic QR codes.

---

## 👥 Team & Subsystem Ownership

| Team Member | Role & Focus Area | Subsystem / Components |
| :--- | :--- | :--- |
| **Swagata** | Blockchain & Backend Lead | Hyperledger Fabric, chaincode smart contracts, Express API & Fabric Gateway |
| **Omkar** | IoT & Security Lead | ESP32 sensors, edge gateway, MQTT broker, threat modeling |
| **Sadique** | ML & Frontend Lead | Isolation Forest anomaly model, React + Vite QR verification portal |

---

## 🛠️ Tech Stack

- **Blockchain:** Hyperledger Fabric v2.x, TypeScript Smart Contracts (Chaincode), Fabric Gateway SDK
- **IoT & Edge:** ESP32, DHT22 Temperature/Humidity Sensor, Mosquitto MQTT Broker
- **Machine Learning:** Python 3.10+, Scikit-Learn (Isolation Forest), Pandas, NumPy, Flask
- **Web & Backend:** Node.js, Express.js, React 19, Vite, `qrcode` generator library

---

## 📂 Repository Structure

```text
ColdChainRx-Portal/
├── backend/                              # Express REST API & QR Code Generator
│   ├── server.js                         # API routes (/verify/:batchId)
│   ├── package.json                      # Dependencies (express, qrcode, cors)
│   └── package-lock.json
├── frontend/                             # React + Vite Web Portal
│   ├── src/                              # Components and UI styling
│   ├── index.html                        # Application entry point
│   ├── vite.config.js                    # Vite bundler configuration
│   └── package.json                      # Frontend dependencies
├── ml-service/                           # Python Anomaly Detection Microservice
│   ├── requirements.txt                  # Python dependencies (scikit-learn, pandas, etc.)
│   └── venv/                             # Virtual environment
├── cleaned_vaccine_temperature_log.csv   # Historical IoT temperature dataset for training
└── README.md                             # Project Documentation & Tutorial Guide
```

---

## 💻 Prerequisites

Ensure you have the following installed on your machine before running the application:

1. **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
2. **npm**: `v9.0.0` or higher (comes bundled with Node.js)
3. **Python**: `v3.10` or higher ([Download Python](https://www.python.org/))
4. **Git**: For version control

---

## 📖 Step-by-Step Tutorial to Run

Follow these instructions to set up and launch each component of the ColdChainRx platform.

### 1. Backend API Server

The backend service runs an Express server that handles QR code generation and batch status verification endpoints.

1. **Navigate to the `backend` directory**:
   ```bash
   cd backend
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Start the Backend Server**:
   ```bash
   npm start
   ```
   *Alternative*:
   ```bash
   node server.js
   ```

4. **Verify Backend Execution**:
   The server will start listening on **`http://localhost:3000`**. You should see the terminal output:
   ```text
   Server running on http://localhost:3000
   ```

---

### 2. Frontend Consumer QR Verification Portal

The frontend is built using React and Vite, serving as the user-facing web app for scanning and viewing batch telemetry.

1. **Open a new terminal window** and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. **Install Frontend dependencies**:
   ```bash
   npm install
   ```

3. **Launch the Vite Development Server**:
   ```bash
   npm run dev
   ```

4. **Access the Portal**:
   Open your browser and navigate to **`http://localhost:5173`**.

---

### 3. Machine Learning Microservice

The ML service uses Scikit-Learn's Isolation Forest algorithm to detect anomalies in vaccine temperature readings from sensor logs.

1. **Open a new terminal window** and navigate to the `ml-service` directory:
   ```bash
   cd ml-service
   ```

2. **Set up Python Virtual Environment**:
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows (Command Prompt)**:
     ```cmd
     python -m venv venv
     venv\Scripts\activate
     ```
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```

3. **Install Required Packages**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Dataset Integration**:
   The primary dataset for model training/testing is located at `cleaned_vaccine_temperature_log.csv` in the root directory.

---

### 4. IoT Edge Gateway & Smart Contracts

- **IoT Telemetry**: ESP32 hardware publishes temperature readings via MQTT to Mosquitto broker.
- **Hyperledger Fabric Chaincode**: TypeScript smart contracts manage permissioned ledger updates.
- **Integration**: The Express backend (`backend/server.js`) interfaces with the Fabric Gateway SDK to update and query batch state.

---

## 🧪 API Reference & Testing

### Verify Batch Status & Generate QR Code

- **Endpoint**: `GET /verify/:batchId`
- **Example URL**: `http://localhost:3000/verify/BATCH123`

#### Quick Test using cURL:
```bash
curl http://localhost:3000/verify/BATCH123
```

#### Example JSON Response:
```json
{
  "success": true,
  "data": {
    "batchId": "BATCH123",
    "status": "Authentic",
    "drugName": "Vaccine-X",
    "message": "Placeholder data. Fabric ledger connection pending."
  },
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

---

## ❓ Troubleshooting & FAQs

- **Port 3000 or 5173 is already in use**:
  Ensure no other node or web service is running on ports `3000` or `5173`. You can terminate conflicting processes or modify the port variable in `backend/server.js` / `frontend/vite.config.js`.

- **CORS Errors in Browser**:
  CORS middleware is enabled in `backend/server.js` via `cors()`. Ensure the Express server is running when making requests from the React frontend.

- **Python Virtual Environment Activation Failed**:
  If PowerShell blocks script execution on Windows, run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
  ```
