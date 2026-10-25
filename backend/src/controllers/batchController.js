const { getContract } = require('../fabricGateway');

/**
 * Create a new drug batch on the blockchain
 * POST /api/batch/create
 */
async function createBatch(req, res) {
  const { id, drugName, manufacturer, minTemp, maxTemp } = req.body;

  if (!id || !drugName || !manufacturer) {
    return res.status(400).json({ error: 'Missing required fields: id, drugName, manufacturer' });
  }

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    if (minTemp !== undefined && maxTemp !== undefined) {
      await conn.contract.submitTransaction(
        'CreateBatchWithThresholds',
        String(id),
        String(drugName),
        String(manufacturer),
        String(minTemp),
        String(maxTemp)
      );
    } else {
      await conn.contract.submitTransaction('CreateBatch', String(id), String(drugName), String(manufacturer));
    }

    return res.status(201).json({
      success: true,
      message: `Batch ${id} successfully created on blockchain.`,
      data: {
        id,
        drugName,
        manufacturer,
        status: 'Manufactured',
        minTemp: minTemp !== undefined ? Number(minTemp) : 2.0,
        maxTemp: maxTemp !== undefined ? Number(maxTemp) : 8.0,
      },
    });
  } catch (error) {
    console.error(`Error in createBatch (${id}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to create batch on blockchain.' });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

/**
 * Assign an IoT sensor box / device to a batch
 * POST /api/device/assign
 */
async function assignDevice(req, res) {
  const { deviceId, batchId } = req.body;

  if (!deviceId || !batchId) {
    return res.status(400).json({ error: 'Missing required fields: deviceId, batchId' });
  }

  const timestamp = new Date().toISOString();
  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    await conn.contract.submitTransaction('AssignDeviceToBatch', String(deviceId), String(batchId), timestamp);

    return res.status(200).json({
      success: true,
      message: `Device '${deviceId}' successfully assigned to batch '${batchId}' on blockchain.`,
      data: { deviceId, batchId, assignedAt: timestamp, active: true },
    });
  } catch (error) {
    console.error(`Error in assignDevice (${deviceId} -> ${batchId}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to assign device on blockchain.' });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

/**
 * Query current batch assigned to an IoT sensor device
 * GET /api/device/:deviceId/batch
 */
async function getDeviceAssignment(req, res) {
  const { deviceId } = req.params;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId parameter' });
  }

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    const resultBytes = await conn.contract.evaluateTransaction('GetDeviceAssignment', String(deviceId));
    const assignment = JSON.parse(new TextDecoder().decode(resultBytes));

    return res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    console.error(`Error in getDeviceAssignment (${deviceId}):`, error);
    return res.status(404).json({ error: error.message || `No active assignment found for device ${deviceId}` });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

/**
 * Unassign an IoT sensor box / device
 * POST /api/device/unassign
 */
async function unassignDevice(req, res) {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing required field: deviceId' });
  }

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    await conn.contract.submitTransaction('UnassignDevice', String(deviceId));

    return res.status(200).json({
      success: true,
      message: `Device '${deviceId}' successfully unassigned on blockchain.`,
      data: { deviceId, active: false },
    });
  } catch (error) {
    console.error(`Error in unassignDevice (${deviceId}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to unassign device on blockchain.' });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

/**
 * Log a temperature and humidity reading (Used by ESP32 + DHT Sensor or Edge Gateways)
 * Resolves device-to-batch assignment if batchId is not provided.
 * POST /api/iot/temperature
 */
async function logTemperature(req, res) {
  const { batchId, id, sensor_id, deviceId, temperature, reporter, timestamp, humidity } = req.body;
  const explicitBatchId = batchId || id;
  const deviceIdentifier = sensor_id || deviceId || reporter;

  if (temperature === undefined) {
    return res.status(400).json({ error: 'Missing required field: temperature' });
  }

  let targetBatchId = explicitBatchId;
  const logTimestamp = timestamp || new Date().toISOString();
  const reporterId = deviceIdentifier || reporter || 'ESP32_DHT_Sensor';
  const tempVal = String(temperature);
  const humVal = humidity !== undefined ? String(humidity) : '0';

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    // 1. Device-to-Batch Resolution: If batchId not passed, resolve via blockchain registry
    if (!targetBatchId) {
      if (!deviceIdentifier) {
        return res.status(400).json({ error: 'Must provide either batchId or sensor_id / deviceId to resolve target batch' });
      }

      try {
        const assignmentBytes = await conn.contract.evaluateTransaction('GetDeviceAssignment', String(deviceIdentifier));
        const assignment = JSON.parse(new TextDecoder().decode(assignmentBytes));
        if (!assignment || !assignment.active || !assignment.batchId) {
          return res.status(400).json({
            error: `Device '${deviceIdentifier}' is not assigned to any active batch. Telemetry rejected.`
          });
        }
        targetBatchId = assignment.batchId;
        console.log(`[Device Resolution] Resolved device '${deviceIdentifier}' -> Batch '${targetBatchId}'`);
      } catch (assignErr) {
        return res.status(400).json({
          error: `Device '${deviceIdentifier}' is unassigned or invalid on blockchain. Telemetry rejected.`
        });
      }
    } else {
      // If batchId is passed, verify target batch exists on blockchain
      try {
        await conn.contract.evaluateTransaction('QueryBatch', String(targetBatchId));
      } catch (batchErr) {
        return res.status(404).json({
          error: `Target batch '${targetBatchId}' does not exist on blockchain. Telemetry rejected.`
        });
      }
    }

    // 2. Submit telemetry to Fabric using LogTelemetry (with humidity), fallback to LogTemperature
    try {
      await conn.contract.submitTransaction('LogTelemetry', targetBatchId, logTimestamp, tempVal, humVal, reporterId);
    } catch (_) {
      await conn.contract.submitTransaction('LogTemperature', targetBatchId, logTimestamp, tempVal, reporterId);
    }

    // 3. Fetch updated state to report excursion alert
    const resultBytes = await conn.contract.evaluateTransaction('QueryBatch', targetBatchId);
    const updatedBatch = JSON.parse(new TextDecoder().decode(resultBytes));

    return res.status(200).json({
      success: true,
      message: `Telemetry logged for batch ${targetBatchId}`,
      receivedData: {
        batchId: targetBatchId,
        resolvedFromDevice: explicitBatchId ? null : deviceIdentifier,
        temperature: Number(temperature),
        humidity: Number(humidity) || 0,
        timestamp: logTimestamp,
        reporter: reporterId,
      },
      blockchainState: {
        excursionAlert: updatedBatch.excursionAlert,
        currentOwner: updatedBatch.currentOwner,
        status: updatedBatch.status,
        minTemp: updatedBatch.minTemp,
        maxTemp: updatedBatch.maxTemp,
        assignedDevice: updatedBatch.assignedDevice,
      },
    });
  } catch (error) {
    console.error(`Error in logTemperature (${targetBatchId || deviceIdentifier}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to log telemetry on blockchain.' });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

/**
 * Transfer custody of a batch
 * POST /api/batch/transfer
 */
async function transferCustody(req, res) {
  const { id, newOwner, newStatus } = req.body;

  if (!id || !newOwner || !newStatus) {
    return res.status(400).json({ error: 'Missing required fields: id, newOwner, newStatus' });
  }

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    await conn.contract.submitTransaction('TransferCustody', id, newOwner, newStatus);

    return res.status(200).json({
      success: true,
      message: `Custody of batch ${id} transferred to ${newOwner}`,
      data: { id, newOwner, newStatus },
    });
  } catch (error) {
    console.error(`Error in transferCustody (${id}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to transfer custody on blockchain.' });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

/**
 * Query current state of a batch
 * GET /api/batch/:id
 */
async function queryBatch(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing batch id parameter' });
  }

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    const resultBytes = await conn.contract.evaluateTransaction('QueryBatch', id);
    const batch = JSON.parse(new TextDecoder().decode(resultBytes));

    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    console.error(`Error in queryBatch (${id}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to query batch from blockchain.' });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

/**
 * Get full audit history of a batch (supports pagination: page, pageSize or limit)
 * GET /api/batch/:id/history
 */
async function getBatchHistory(req, res) {
  const { id } = req.params;
  const { page, pageSize, limit } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing batch id parameter' });
  }

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    const pageNum = parseInt(page, 10) || 1;
    const size = parseInt(pageSize || limit, 10) || 50;

    let history;
    let paginationInfo = null;

    try {
      // Attempt paginated query first
      const resultBytes = await conn.contract.evaluateTransaction(
        'GetBatchHistoryPaginated',
        id,
        String(size),
        String(pageNum)
      );
      const paginatedResult = JSON.parse(new TextDecoder().decode(resultBytes));
      history = paginatedResult.records;
      paginationInfo = {
        totalRecords: paginatedResult.totalRecords,
        page: paginatedResult.page,
        pageSize: paginatedResult.pageSize,
        totalPages: paginatedResult.totalPages,
        hasMore: paginatedResult.hasMore,
      };
    } catch (paginatedErr) {
      // Fallback to standard GetBatchHistory
      console.warn(`[History] Falling back to GetBatchHistory: ${paginatedErr.message}`);
      const resultBytes = await conn.contract.evaluateTransaction('GetBatchHistory', id);
      history = JSON.parse(new TextDecoder().decode(resultBytes));
    }

    const responseData = { success: true, data: history };
    if (paginationInfo) {
      responseData.pagination = paginationInfo;
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(`Error in getBatchHistory (${id}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to fetch batch history from blockchain.' });
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

module.exports = {
  createBatch,
  assignDevice,
  getDeviceAssignment,
  unassignDevice,
  logTemperature,
  transferCustody,
  queryBatch,
  getBatchHistory,
};
