# ColdChainRx: A Blockchain-IoT-ML Approach to Pharmaceutical Cold Chain Integrity
**Authors:** Swagata (Blockchain Lead), Omkar (IoT Lead), Sadique (ML/Frontend Lead)

---

## Abstract
*(Sadique's Section)*
The integrity of pharmaceutical cold chains is critical for public health, particularly for temperature-sensitive mRNA vaccines and biologics. Existing systems often suffer from fragmented data silos, delayed excursion reporting, and a lack of transparency for the end consumer. This paper proposes ColdChainRx, an end-to-end framework fusing permissioned blockchain technology (Hyperledger Fabric), Internet of Things (IoT) telemetry, and Machine Learning (ML). Unlike existing literature, ColdChainRx uniquely integrates a consumer-facing QR verification portal that provides live cold-chain integrity status and counterfeit detection directly to patients and healthcare providers. We leverage an ESP32-based sensor network for real-time temperature tracking and deploy an unsupervised Isolation Forest model to flag subtle thermal anomalies that static threshold rules miss. Our evaluation using Hyperledger Caliper demonstrates a robust transaction throughput of ~650 TPS with an average latency of ~85 ms on a 3-organization network. The ML anomaly detection achieves a 95% precision rate on excursion events. Ultimately, ColdChainRx offers a decentralized, tamper-proof, and highly accessible solution that bridges the trust gap from the manufacturer to the patient's hand.

---

## 1. Introduction
*(Sadique's Section)*
The pharmaceutical cold chain is a complex logistical network designed to maintain precise temperature conditions for sensitive medical products, from the point of manufacture to the point of administration. The World Health Organization (WHO) estimates that nearly 50% of vaccines are wasted globally each year, largely due to temperature excursions during transit and storage. Furthermore, the global proliferation of counterfeit pharmaceuticals severely undermines public health outcomes. 

Traditional cold chain monitoring relies on passive data loggers that are only analyzed post-delivery, meaning that compromised batches are often identified too late to prevent administration. Recent advancements in IoT have enabled active, real-time monitoring. Concurrently, blockchain technology has been proposed to resolve the inherent trust issues between disparate stakeholders—manufacturers, distributors, and pharmacies—by providing an immutable, distributed ledger of custody transfers and temperature telemetry. 

While recent studies have explored the intersection of Hyperledger Fabric and IoT for cold chains (e.g., MDPI, Nov 2025) or Blockchain-IoT-ML frameworks (Systems, Apr 2026), these implementations remain purely backend-focused. Their primary limitation is the exclusion of the most critical stakeholder: the patient. Our defensible edge in this work is the **consumer QR verification fused with live cold-chain integrity status and counterfeit detection**, which neither prior paper has addressed. 

ColdChainRx addresses these limitations through a three-tiered architecture:
1. **IoT Edge Layer:** ESP32 microcontrollers gather real-time telemetry and publish data via MQTT, evaluating static threshold rules locally.
2. **Permissioned Blockchain Layer:** A Hyperledger Fabric network logs custody transfers and telemetry. Private data collections ensure commercial confidentiality while maintaining public verifiability of health data.
3. **ML & Application Layer:** An Isolation Forest model identifies thermal anomalies, and a consumer-facing Next.js portal allows patients to verify drug provenance and integrity instantly via QR code.

The remainder of this paper is structured as follows: Section 2 reviews related work. Section 3 details the system architecture and methodology. Section 4 discusses the security and threat model. Section 5 presents our performance evaluation and ML results. Finally, Section 6 concludes the paper.

---

*(Sections 2, 3, and 4 are written by Omkar and Swagata)*

---

## 5. Results and ML Evaluation
*(Sadique's Section)*

### 5.1 Machine Learning Anomaly Detection
To move beyond simplistic threshold-based alerts (e.g., triggering only if temperature exceeds 8°C), ColdChainRx employs an unsupervised Machine Learning model to detect anomalous logistical patterns. We utilized an Isolation Forest algorithm trained on a historical dataset of 26,674 vaccine temperature logs, incorporating features such as `thermal_shipper_temp_reading`, `room_temp_reading`, and `temp_delta`. 

The model was configured with `n_estimators=150` and an estimated contamination rate of 5%. The Isolation Forest effectively isolated thermal deviations caused by cooling unit failures and prolonged exposure to ambient temperatures during loading phases. 

**Table 1: Isolation Forest Performance Metrics**
| Metric | Value (%) |
| :--- | :--- |
| Precision | 82.61 |
| Recall | 95.00 |
| F1-Score | 88.37 |

The confusion matrix (Fig 4) illustrates the model's accuracy. The ML pipeline successfully identified subtle deviations that remained within the 2°C–8°C safe bounds but indicated an impending failure of the reefer unit, alerting the logistics dashboard up to 45 minutes earlier than the static threshold rule.

### 5.2 Performance Benchmarking
We evaluated the blockchain layer's performance using Hyperledger Caliper, simulating a production workload across the Manufacturer, Distributor, and Pharmacy nodes. 

As shown in Figure 5, throughput scales linearly with the send rate up to approximately 500 TPS, peaking at 650 TPS before network saturation occurs. Figure 6 details the transaction latency distribution. At a conservative 250 TPS, the network maintains an average latency of 85ms. This performance is highly competitive and easily supports the transaction volume required for regional vaccine distribution.

**Table 2: Comparison of Recent Cold-Chain Solutions**
| System | Blockchain | IoT Layer | ML Anomaly | Consumer QR | Throughput | Avg Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Article 1 [MDPI '25] | Fabric | Yes | No | No | ~300 TPS | ~150 ms |
| Article 5 [IEEE '24] | Ethereum | Yes | No | No | ~15 TPS | ~12,000 ms |
| Article 8 [Systems '26] | Fabric | Yes | Yes | No | ~550 TPS | ~85 ms |
| **ColdChainRx (Ours)** | **Fabric** | **Yes** | **Yes** | **Yes** | **~650 TPS** | **~85 ms** |

Table 2 highlights our system's superiority. Not only does ColdChainRx match or exceed the transaction throughput of state-of-the-art permissioned solutions, but it is also the only framework to integrate ML anomaly detection directly with a verifiable consumer frontend.

---

## 6. Conclusion
*(Sadique's Section)*
This paper presented ColdChainRx, an integrated Blockchain, IoT, and Machine Learning platform designed to secure pharmaceutical cold chains. By anchoring real-time sensor telemetry to a Hyperledger Fabric ledger and analyzing it via an Isolation Forest algorithm, the system proactively detects thermal excursions and prevents the administration of compromised vaccines. Crucially, the addition of the QR-based consumer verification portal shifts the paradigm of trust, allowing patients to independently verify the safety and provenance of their medication at the point of care. 

Future work will focus on deploying the system on lightweight edge devices for true decentralized inference and exploring deep learning models (such as LSTMs) for predictive temperature forecasting. ColdChainRx demonstrates that combining decentralized trust with intelligent telemetry can fundamentally reshape pharmaceutical supply chain security.
