# ColdChainRx — Security Threat Model & Attack/Mitigation Experiments
**Lead:** Omkar (IoT + Security Lead)  
**Deliverable:** Week 7 Technical Milestone  
**System Evaluated:** Hyperledger Fabric v2.5 + Express API Proxy + Next.js Portal + Python Edge Gateway

---

## 1. STRIDE Threat Model

| STRIDE Category | Threat Description | Attack Surface | Mitigation in ColdChainRx | Experimental Validation |
|---|---|---|---|---|
| **Spoofing** | Attacker impersonates a legitimate ESP32 sensor or unauthorized node to forge temperature records. | MQTT broker (`:1883`), Fabric REST API (`/api/iot/temperature`) | Multi-field validation in `gateway.py`, authorized sensor registry, client authentication tokens. | **Experiment B (B1–B4):** Tested fake/stale batch IDs and malformed credentials. |
| **Tampering** | Intercepting in-transit packets or modifying historical temperature data stored off-chain to hide a cold-chain excursion. | Sensor network, IPFS off-chain storage | 1. Input sanitization at edge gateway.<br>2. Cryptographic SHA-256 hash anchoring on Fabric blockchain ledger.<br>3. Anti-tamper verification endpoint (`/api/security/offchain/verify`). | **Experiment A:**<br>1. Injected 8 malformed payloads.<br>2. Uploaded telemetry to IPFS, altered data, and verified cryptographic mismatch detection (`tampered: true, matches: false`). |
| **Repudiation** | A carrier or logistics provider claims a temperature excursion occurred after custody transfer or denies having possessed a compromised batch. | Chaincode `TransferCustody` & `RecordTempReading` | Every custody transfer and temperature log is cryptographically signed by the organization's MSP and timestamped immutably on the Fabric channel. | Built-in Hyperledger Fabric consensus & endorsement policies. |
| **Information Disclosure** | Competitors or unauthorized parties eavesdrop on sensitive pharmaceutical shipment quantities, prices, or destinations. | Ledger queries, off-chain storage | 1. AES-256-GCM encryption for off-chain payloads (`/api/security/encrypt`).<br>2. Hyperledger Fabric Private Data Collections (PDC) separating commercial data from public health telemetry. | Encryption/decryption verified live with AES-256-GCM authenticated tags. |
| **Denial of Service (DoS)** | Attacker floods the consumer verification portal or Fabric gateway with requests to exhaust CPU/memory or block legitimate verifications. | Express Proxy (`:3001`), Next.js Frontend (`:3000`) | 1. `express-rate-limit` middleware (`verifyLimiter`: 20 req / 5 min; `apiLimiter`: 100 req / 15 min).<br>2. Request body size clamping (`limit: '10kb'`).<br>3. Helmet security headers. | **Experiment C:** Parallel flood (25 requests) triggered HTTP 429 "Too many verification attempts" for 6/25 requests. |
| **Elevation of Privilege** | An unauthorized carrier attempts to invoke administrative chaincode functions (e.g., `CreateBatch` or override `FlagExcursion`). | Fabric gRPC endorser, REST API | Fabric Channel Access Control Lists (ACL) and MSP identity verification enforce that only Manufacturer MSP can create batches. | **Experiment B:** Evaluated non-existent batch writing and buffer overflow probes. |

---

## 2. Experimental Demonstrations & Findings

### Experiment A: Data Poisoning & Off-Chain Anti-Tamper Verification (`exp_a_tamper.py`)
- **Part 1 (Gateway/API Injection):** Tested 8 malicious vectors (extreme temps `-200°C` and `+500°C`, null values, string values, missing IDs, SQL injection, illegal humidity `150%`, empty body).
  - *Mitigations active:* Null temperature, string temperature, and empty JSON bodies are immediately rejected with HTTP 500 / 400.
  - *Identified Research Finding:* Physical boundary checks (e.g., `-200°C` or `+500°C`) should be enforced at both the edge gateway AND the smart contract layer to prevent bypass.
- **Part 2 (IPFS Off-Chain Anti-Tamper):**
  - Uploaded telemetry to IPFS storage (`QmZtTK6Ru...`).
  - Tampered with temperature values (`-10°C`, `+50°C`) and submitted to `/api/security/offchain/verify`.
  - **Result:** Successfully detected! `{"success": true, "matches": false, "tampered": true, "message": "ALERT: Data hash mismatch! Content has been modified/tampered with."}`.

### Experiment B: Access Control & Unauthorized Batch Writes (`exp_b_unauthorized_write.py`)
- Evaluated 7 scenarios including random fake batches, stale batches from prior ledger states, empty strings, numeric type confusion, long string overflows, and path traversals.
- Type confusion (numeric batch ID) was immediately rejected with HTTP 500.

### Experiment C: DoS Defence & Rate Limiting (`exp_c_rate_limit.py`)
- Sent high-concurrency burst of 25 requests to `http://localhost:3001/verify/BATCH_1792760493` with 15 parallel workers.
- **Result:** Rate limiter engaged, intercepting 6 requests with `HTTP 429 Too Many Requests`.
- Confirmed DoS mitigation protects the consumer portal against scraping and service degradation.
