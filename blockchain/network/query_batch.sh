#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./query_batch.sh <BATCH_ID>"
  echo "Example: ./query_batch.sh BATCH1001"
  exit 1
fi

BATCH_ID="$1"

export FABRIC_CFG_PATH="$PWD/../../config"
PEER_BIN="$PWD/../../bin/peer"
MANUFACTURER_CA="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/peers/peer0.manufacturer.coldchainrx.com/tls/ca.crt"

export CORE_PEER_LOCALMSPID="ManufacturerMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$MANUFACTURER_CA"
export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/users/Admin@manufacturer.coldchainrx.com/msp"
export CORE_PEER_ADDRESS=peer0.manufacturer.coldchainrx.com:7051
export CORE_PEER_TLS_ENABLED=true
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE

echo "=================================================="
echo "1. CURRENT BLOCKCHAIN STATE FOR: '$BATCH_ID'"
echo "=================================================="
"$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"QueryBatch\",\"$BATCH_ID\"]}" | python3 -m json.tool 2>/dev/null || "$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"QueryBatch\",\"$BATCH_ID\"]}"

echo ""
echo ""
echo "=================================================="
echo "2. IMMUTABLE TRANSACTION HISTORY FOR: '$BATCH_ID'"
echo "=================================================="
"$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"GetBatchHistory\",\"$BATCH_ID\"]}" | python3 -m json.tool 2>/dev/null || "$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"GetBatchHistory\",\"$BATCH_ID\"]}"

