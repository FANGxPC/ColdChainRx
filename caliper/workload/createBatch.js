'use strict';

let txIndex = 0;
let contractId = 'coldchainrx';

async function initializeWorkloadModule(testContext) {
  contractId = testContext.args.contractId || 'coldchainrx';
}

async function submitTransaction(sutAdapter) {
  txIndex++;
  const batchId = `BENCH_BATCH_${Date.now()}_${txIndex}`;
  const drugName = 'Polio-Vaccine-Oral';
  const manufacturer = 'Serum-Institute';

  const request = {
    contractId: contractId,
    contractFunction: 'CreateBatch',
    contractArguments: [batchId, drugName, manufacturer],
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
