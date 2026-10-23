# Hyperledger Fabric Performance Evaluation (Caliper Report)

Generated on: 2026-10-19T09:18:35.063Z
Network: Hyperledger Fabric 2.5 (3 Orgs: Manufacturer, Distributor, Pharmacy + Raft Orderer)
Channel: `coldchainchannel` | Chaincode: `coldchainrx`

### Experimental Results Summary Table

| Operation / Workload | Type | Sent | Success | Throughput (TPS) | Min Latency (ms) | Avg Latency (ms) | Max Latency (ms) | P95 Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **CreateBatch (State Initialization)** | WRITE | 100 | 100 | **23.4** | 27.03 | **42.5** | 62.83 | 55.75 |
| **LogTemperature (IoT Sensor Telemetry Write)** | WRITE | 200 | 200 | **46.9** | 23.04 | **35.6** | 56.85 | 46.47 |
| **QueryBatch (Consumer QR Code Verification)** | READ | 300 | 300 | **71.1** | 6 | **12.3** | 27.48 | 17.93 |
| **GetBatchHistory (Full Provenance Audit Trail)** | READ | 150 | 150 | **69.9** | 10.02 | **18.4** | 35.06 | 25.28 |


### Scientific Insights for Research Paper
- **Sensor Write Throughput:** The network safely sustains high-frequency IoT temperature updates (>45 TPS) well below the 100ms cold-chain SLA.
- **Consumer Verification Latency:** QR code lookups (`QueryBatch`) average ~12ms, enabling instant scan-to-verify mobile experiences.
- **Consensus Overhead:** 3-organization endorsement with TLS mutual authentication introduces minimal latency overhead (~35–42ms for state commits).
