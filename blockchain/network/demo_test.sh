#!/bin/bash
set -e

# Generate a unique Batch ID for each test run using current timestamp
BATCH_ID="BATCH_$(date +%s)"

export FABRIC_CFG_PATH="$PWD/../../config"
PEER_BIN="$PWD/../../bin/peer"
ORDERER_CA="$PWD/organizations/ordererOrganizations/coldchainrx.com/orderers/orderer.coldchainrx.com/tls/ca.crt"
MANUFACTURER_CA="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/peers/peer0.manufacturer.coldchainrx.com/tls/ca.crt"
DISTRIBUTOR_CA="$PWD/organizations/peerOrganizations/distributor.coldchainrx.com/peers/peer0.distributor.coldchainrx.com/tls/ca.crt"

# Set Org to Manufacturer
export CORE_PEER_LOCALMSPID="ManufacturerMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$MANUFACTURER_CA"
export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/users/Admin@manufacturer.coldchainrx.com/msp"
export CORE_PEER_ADDRESS=peer0.manufacturer.coldchainrx.com:7051
export CORE_PEER_TLS_ENABLED=true
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE

echo "=================================================="
echo "DEMO STEP 1: Creating Batch '$BATCH_ID'"
echo "=================================================="
"$PEER_BIN" chaincode invoke -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --tls --cafile "$ORDERER_CA" \
  -C coldchainchannel -n coldchainrx \
  --peerAddresses peer0.manufacturer.coldchainrx.com:7051 --tlsRootCertFiles "$MANUFACTURER_CA" \
  --peerAddresses peer0.distributor.coldchainrx.com:8051 --tlsRootCertFiles "$DISTRIBUTOR_CA" \
  -c "{\"Args\":[\"CreateBatch\",\"$BATCH_ID\",\"Polio Vaccine\",\"Pfizer\"]}"

sleep 3

echo ""
echo "=================================================="
echo "DEMO STEP 2: Querying Batch '$BATCH_ID'"
echo "=================================================="
"$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"QueryBatch\",\"$BATCH_ID\"]}"

sleep 2

echo ""
echo "=================================================="
echo "DEMO STEP 3: Logging Safe Temperature (4.5°C)"
echo "=================================================="
"$PEER_BIN" chaincode invoke -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --tls --cafile "$ORDERER_CA" \
  -C coldchainchannel -n coldchainrx \
  --peerAddresses peer0.manufacturer.coldchainrx.com:7051 --tlsRootCertFiles "$MANUFACTURER_CA" \
  --peerAddresses peer0.distributor.coldchainrx.com:8051 --tlsRootCertFiles "$DISTRIBUTOR_CA" \
  -c "{\"Args\":[\"LogTemperature\",\"$BATCH_ID\",\"2026-09-20T12:00:00Z\",\"4.5\",\"Sensor_Omkar_01\"]}"

sleep 3

echo ""
echo "=================================================="
echo "DEMO STEP 4: Transferring Custody to DHL Logistics"
echo "=================================================="
"$PEER_BIN" chaincode invoke -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --tls --cafile "$ORDERER_CA" \
  -C coldchainchannel -n coldchainrx \
  --peerAddresses peer0.manufacturer.coldchainrx.com:7051 --tlsRootCertFiles "$MANUFACTURER_CA" \
  --peerAddresses peer0.distributor.coldchainrx.com:8051 --tlsRootCertFiles "$DISTRIBUTOR_CA" \
  -c "{\"Args\":[\"TransferCustody\",\"$BATCH_ID\",\"DHL Logistics\",\"InTransit\"]}"

sleep 3

echo ""
echo "=================================================="
echo "DEMO STEP 5: Logging Excursion Temperature (10.2°C - SPOILED!)"
echo "=================================================="
"$PEER_BIN" chaincode invoke -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --tls --cafile "$ORDERER_CA" \
  -C coldchainchannel -n coldchainrx \
  --peerAddresses peer0.manufacturer.coldchainrx.com:7051 --tlsRootCertFiles "$MANUFACTURER_CA" \
  --peerAddresses peer0.distributor.coldchainrx.com:8051 --tlsRootCertFiles "$DISTRIBUTOR_CA" \
  -c "{\"Args\":[\"LogTemperature\",\"$BATCH_ID\",\"2026-09-20T12:30:00Z\",\"10.2\",\"Sensor_Omkar_01\"]}"

sleep 3

echo ""
echo "=================================================="
echo "DEMO STEP 6: Querying Batch '$BATCH_ID' State & Excursion Alert"
echo "=================================================="
"$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"QueryBatch\",\"$BATCH_ID\"]}"

sleep 2

echo ""
echo "=================================================="
echo "DEMO STEP 7: Fetching Full Audit History for '$BATCH_ID'"
echo "=================================================="
"$PEER_BIN" chaincode query -C coldchainchannel -n coldchainrx -c "{\"Args\":[\"GetBatchHistory\",\"$BATCH_ID\"]}"
