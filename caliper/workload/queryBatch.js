'use strict';

let contractId = 'coldchainrx';
const targetBatch = 'BENCHMARK_BATCH_ACTIVE';

async function initializeWorkloadModule(testContext) {
  contractId = testContext.args.contractId || 'coldchainrx';
}

async function submitTransaction(sutAdapter) {
  const request = {
    contractId: contractId,
    contractFunction: 'QueryBatch',
    contractArguments: [targetBatch],
    readOnly: true,
  };

  await sutAdapter.sendRequests(request);
}

module.exports.createWorkloadModule = () => {
  return {
    initializeWorkloadModule,
    submitTransaction,
  };
};
