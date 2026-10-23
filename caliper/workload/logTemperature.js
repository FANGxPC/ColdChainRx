'use strict';

let txIndex = 0;
let contractId = 'coldchainrx';
const targetBatch = 'BENCHMARK_BATCH_ACTIVE';

async function initializeWorkloadModule(testContext) {
  contractId = testContext.args.contractId || 'coldchainrx';
}

async function submitTransaction(sutAdapter) {
  txIndex++;
  const timestamp = new Date().toISOString();
  // Generate random temperature between 3.5C and 5.5C
  const temp = (3.5 + Math.random() * 2.0).toFixed(2);
  const reporter = `Sensor_Caliper_${txIndex % 10}`;

  const request = {
    contractId: contractId,
    contractFunction: 'LogTemperature',
    contractArguments: [targetBatch, timestamp, String(temp), reporter],
    readOnly: false,
  };

  await sutAdapter.sendRequests(request);
}

module.exports.createWorkloadModule = () => {
  return {
    initializeWorkloadModule,
    submitTransaction,
  };
};
