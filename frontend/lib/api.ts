/**
 * ColdChainRx Centralized Backend API Client
 * Manages communication between Next.js frontend and Express proxy (Port 3001)
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/+$/, "");

export type BatchItem = {
  id: string;
  batchId: string;
  drugName: string;
  manufacturer: string;
  currentOwner: string;
  assignedDevice: string;
  deviceId?: string;
  minTemp: number;
  maxTemp: number;
  minSafe: number;
  maxSafe: number;
  mfgDate: string | null;
  expDate: string | null;
  status: string;
  rawStatus?: string;
  storageType?: string;
  excursionAlert: boolean;
  quantity?: number;
  latestTemperature: number | null;
  latestHumidity: number | null;
  lastReadingTimestamp: string | null;
  freshnessStatus: "Streaming Live" | "Device Offline" | "No Telemetry Recorded";
  assignmentStatus: "Unassigned" | "Assigned" | "Monitoring" | "Shipment Completed" | "Assignment Error";
  coldChainStatus: "Normal" | "Critical Excursion";
  readings?: Array<{
    time: string;
    temp: number;
    humidity: number;
    location: string;
    hop: string;
    status: string;
    timestamp?: string;
  }>;
  temperatureLogs?: Array<{
    timestamp: string;
    temperature: number;
    humidity: number;
    reporter: string;
  }>;
  _live?: boolean;
  _mock?: boolean;
  _cached?: boolean;
};

export type DeviceItem = {
  deviceId: string;
  assignedBatch: string | null;
  status: "Available" | "Assigned" | "Maintenance";
  model?: string;
  lastSeen?: string;
};

export type CreateBatchPayload = {
  id: string;
  drugName: string;
  manufacturer: string;
  minTemp: number;
  maxTemp: number;
  mfgDate: string;
  expDate: string;
  quantity?: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  count?: number;
  message?: string;
  error?: string;
  txId?: string;
  qrCode?: string;
  _fallback?: boolean;
  _mock?: boolean;
};

export const api = {
  /**
   * List all tracked batches with live statuses and telemetry
   */
  async getBatches(): Promise<ApiResponse<BatchItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/api/batches`, {
        cache: "no-store",
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to reach backend." };
    }
  },

  /**
   * Retrieve a specific batch by ID (Current State from Ledger)
   */
  async getBatch(id: string): Promise<ApiResponse<BatchItem>> {
    try {
      const res = await fetch(`${API_BASE}/api/batch/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to reach backend." };
    }
  },

  /**
   * Retrieve complete ledger audit history (Provenance / Hops)
   */
  async getBatchHistory(id: string, pageSize = 50): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/api/batch/${encodeURIComponent(id)}/history?pageSize=${pageSize}`, {
        cache: "no-store",
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to retrieve history." };
    }
  },

  /**
   * List available and assigned IoT hardware devices
   */
  async getDevices(): Promise<ApiResponse<DeviceItem[]>> {
    try {
      const res = await fetch(`${API_BASE}/api/devices`, {
        cache: "no-store",
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to retrieve devices." };
    }
  },

  /**
   * Check Device-to-Batch Mapping
   */
  async getDeviceBatch(deviceId: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/api/device/${encodeURIComponent(deviceId)}/batch`, {
        cache: "no-store",
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to query device assignment." };
    }
  },

  /**
   * Fetch Off-Chain / IPFS Storage Data
   */
  async getOffchainData(cid: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/api/security/offchain/${encodeURIComponent(cid)}`, {
        cache: "no-store",
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to retrieve off-chain IPFS data." };
    }
  },

  /**
   * Register a new medicine batch (submits to Hyperledger Fabric)
   */
  async createBatch(payload: CreateBatchPayload): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/api/batch/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Network error submitting batch." };
    }
  },

  /**
   * Assign a sensor box to a medicine batch
   */
  async assignDevice(deviceId: string, batchId: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/api/device/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, batchId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Network error assigning device." };
    }
  },

  /**
   * Unassign a sensor box from a batch
   */
  async unassignDevice(deviceId: string, batchId?: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/api/device/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, batchId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Network error unassigning device." };
    }
  },

  /**
   * Transfer custody of a batch
   */
  async transferBatch(id: string, newOwner: string, newStatus: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/api/batch/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, newOwner, newStatus }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Network error transferring batch." };
    }
  },

  /**
   * Query ML anomaly prediction
   */
  async checkAnomaly(batchId: string, payload: { temperature: number; humidity?: number; timestamp?: string }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/api/batches/${encodeURIComponent(batchId)}/anomaly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sensor_id: batchId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
