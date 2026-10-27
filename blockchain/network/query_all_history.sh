#!/bin/bash

# Navigate to network directory where TLS certs exist
cd "$(dirname "$0")"

export FABRIC_CFG_PATH="$PWD/../../config"
PEER_BIN="$PWD/../../bin/peer"
MANUFACTURER_CA="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/peers/peer0.manufacturer.coldchainrx.com/tls/ca.crt"

export CORE_PEER_LOCALMSPID="ManufacturerMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$MANUFACTURER_CA"
export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/users/Admin@manufacturer.coldchainrx.com/msp"
export CORE_PEER_ADDRESS=peer0.manufacturer.coldchainrx.com:7051
export CORE_PEER_TLS_ENABLED=true
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE

# If user provided a batch list, use that; otherwise use default demo batches
if [ $# -gt 0 ]; then
  BATCHES=("$@")
else
  BATCHES=("BATCH_3" "BATCH001" "BATCH-V2026-001" "BATCH-V2026-EXC")
fi

echo "================================================================"
echo "🧊 COLDCHAINRX BLOCKCHAIN AUDIT – ALL ACTIVE BATCHES & HISTORIES"
echo "================================================================"

for BATCH_ID in "${BATCHES[@]}"; do
  echo ""
  echo "----------------------------------------------------------------"
  echo "📦 BATCH: $BATCH_ID"
  echo "----------------------------------------------------------------"
  
  echo "🔍 [1. Current Ledger State & Sensors]:"
  STATE=$("$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"QueryBatch\",\"$BATCH_ID\"]}" 2>&1)
  
  if echo "$STATE" | grep -q "the batch.*does not exist"; then
    echo "   ⚠️ Batch '$BATCH_ID' does not exist on ledger."
    continue
  fi
  
  echo "$STATE" | python3 -m json.tool 2>/dev/null || echo "$STATE"
  
  echo ""
  echo "📜 [2. Immutable Block Transaction History]:"
  HISTORY=$("$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"GetBatchHistory\",\"$BATCH_ID\"]}" 2>&1)
  echo "$HISTORY" | python3 -m json.tool 2>/dev/null || echo "$HISTORY"
  
  echo ""
done

echo "================================================================"
echo "✅ Audit completed across all requested batches."
echo "================================================================"
