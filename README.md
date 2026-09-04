# ColdChainRx
A permissioned Hyperledger Fabric platform fusing IoT temperature telemetry, ML anomaly detection, and consumer-facing QR verification for pharmaceutical cold chains[cite: 1, 2].

## Team & Subsystem Ownership
- **Swagata:** Blockchain & Backend Lead (Hyperledger Fabric, chaincode, network)[cite: 1]
- **Omkar:** IoT & Security Lead (sensors, edge gateway, MQTT, threat modeling)[cite: 1]
- **Sadique:** ML & Frontend Lead (QR portal, anomaly detection, consumer app)[cite: 1]

## Tech Stack
- **Blockchain:** Hyperledger Fabric v2.x, TypeScript Chaincode, Fabric Gateway SDK
- **IoT & Edge:** ESP32, DHT22, Mosquitto MQTT Broker
- **Machine Learning:** Python, Scikit-Learn (Isolation Forest), Flask
- **Web App:** React, Vite, Express.js, Node.js, `qrcode`

## Repository Structure
```text
ColdChainRx/
├── chaincode/      # Hyperledger Fabric smart contracts (TypeScript)
├── iot-gateway/    # ESP32 firmware & MQTT client publisher scripts
├── backend/        # Express API & Fabric Gateway integration handlers
├── frontend/       # React + Vite consumer QR verification portal
└── ml-service/     # Python Isolation Forest training & inference microservice
