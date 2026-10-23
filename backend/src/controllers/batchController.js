const { getContract } = require('../fabricGateway');

/**
 * Create a new drug batch on the blockchain
 * POST /api/batch/create
 */
async function createBatch(req, res) {
  const { id, drugName, manufacturer } = req.body;

  if (!id || !drugName || !manufacturer) {
    return res.status(400).json({ error: 'Missing required fields: id, drugName, manufacturer' });
  }

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    await conn.contract.submitTransaction('CreateBatch', id, drugName, manufacturer);

    return res.status(201).json({
      success: true,
      message: `Batch ${id} successfully created on blockchain.`,
      data: { id, drugName, manufacturer, status: 'Manufactured' },
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
 * Log a temperature reading (Used by ESP32 + DHT11 Sensor or API clients)
 * POST /api/iot/temperature
 */
async function logTemperature(req, res) {
  const { batchId, id, sensor_id, temperature, reporter, timestamp, humidity } = req.body;
  const targetId = batchId || id || sensor_id;

  if (!targetId || temperature === undefined) {
    return res.status(400).json({ error: 'Missing required fields: batchId (or id/sensor_id) and temperature' });
  }

  const logTimestamp = timestamp || new Date().toISOString();
  const reporterId = reporter || sensor_id || 'ESP32_DHT11_Sensor';
  const tempVal = String(temperature);

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    // Ensure target batch exists on blockchain; if not, auto-create it for IoT readings
    try {
      await conn.contract.evaluateTransaction('QueryBatch', targetId);
    } catch (err) {
      console.log(`[IoT] Auto-creating batch '${targetId}' on ledger for incoming sensor reading...`);
      await conn.contract.submitTransaction('CreateBatch', targetId, 'Medical Cold Chain Supply', 'DefaultManufacturer');
    }

    await conn.contract.submitTransaction('LogTemperature', targetId, logTimestamp, tempVal, reporterId);

    // Also fetch updated state to report if an excursion alert was triggered
    const resultBytes = await conn.contract.evaluateTransaction('QueryBatch', targetId);
    const updatedBatch = JSON.parse(new TextDecoder().decode(resultBytes));

    return res.status(200).json({
      success: true,
      message: `Temperature logged for batch ${targetId}`,
      receivedData: { batchId: targetId, temperature: Number(temperature), humidity, timestamp: logTimestamp, reporter: reporterId },
      blockchainState: {
        excursionAlert: updatedBatch.excursionAlert,
        currentOwner: updatedBatch.currentOwner,
        status: updatedBatch.status,
      },
    });
  } catch (error) {
    console.error(`Error in logTemperature (${targetId}):`, error);
    return res.status(500).json({ error: error.message || 'Failed to log temperature on blockchain.' });
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
  logTemperature,
  transferCustody,
  queryBatch,
  getBatchHistory,
};
