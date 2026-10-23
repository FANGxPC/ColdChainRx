#!/bin/bash
set -e

echo "=== ColdChainRx Chaincode Upgrade ==="

export PATH=/usr/local/bin:/usr/local/go/bin:$PATH
export FABRIC_CFG_PATH="$PWD/../../config"
PEER_BIN="$PWD/../../bin/peer"

CC_NAME="coldchainrx"
CC_PACKAGE_FILE="coldchainrx.tar.gz"

set_org() {
  ORG=$1
  if [ "$ORG" == "Manufacturer" ]; then
    export CORE_PEER_LOCALMSPID="ManufacturerMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/peers/peer0.manufacturer.coldchainrx.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/users/Admin@manufacturer.coldchainrx.com/msp"
    export CORE_PEER_ADDRESS=peer0.manufacturer.coldchainrx.com:7051
  elif [ "$ORG" == "Distributor" ]; then
    export CORE_PEER_LOCALMSPID="DistributorMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$PWD/organizations/peerOrganizations/distributor.coldchainrx.com/peers/peer0.distributor.coldchainrx.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/distributor.coldchainrx.com/users/Admin@distributor.coldchainrx.com/msp"
    export CORE_PEER_ADDRESS=peer0.distributor.coldchainrx.com:8051
  elif [ "$ORG" == "Pharmacy" ]; then
    export CORE_PEER_LOCALMSPID="PharmacyMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$PWD/organizations/peerOrganizations/pharmacy.coldchainrx.com/peers/peer0.pharmacy.coldchainrx.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/pharmacy.coldchainrx.com/users/Admin@pharmacy.coldchainrx.com/msp"
    export CORE_PEER_ADDRESS=peer0.pharmacy.coldchainrx.com:9451
  fi
  export CORE_PEER_TLS_ENABLED=true
  unset CORE_PEER_TLS_SERVERHOSTOVERRIDE
}

# Auto-detect current sequence from the ledger
set_org "Manufacturer"
COMMITTED_DEF=$("$PEER_BIN" lifecycle chaincode querycommitted --channelID coldchainchannel --name ${CC_NAME} 2>/dev/null || true)
if echo "$COMMITTED_DEF" | grep -q "Sequence:"; then
  CURRENT_SEQ=$(echo "$COMMITTED_DEF" | grep -o 'Sequence: [0-9]*' | awk '{print $2}')
  CC_SEQUENCE=$((CURRENT_SEQ + 1))
  CC_VERSION="1.${CURRENT_SEQ}"
  echo "Existing chaincode found at Sequence ${CURRENT_SEQ}. Upgrading to Sequence ${CC_SEQUENCE} (v${CC_VERSION})..."
else
  CC_SEQUENCE="1"
  CC_VERSION="1.0"
  echo "No existing chaincode definition on channel. Deploying Sequence 1 (v${CC_VERSION})..."
fi

echo "1. Packaging Chaincode (${CC_NAME}_${CC_VERSION})..."
rm -f ${CC_PACKAGE_FILE}
"$PEER_BIN" lifecycle chaincode package ${CC_PACKAGE_FILE} \
  --path ../../chaincode/coldchainrx \
  --lang golang \
  --label ${CC_NAME}_${CC_VERSION}

echo "Chaincode packaged into ${CC_PACKAGE_FILE}."

echo "2. Installing Chaincode on Manufacturer Peer..."
set_org "Manufacturer"
"$PEER_BIN" lifecycle chaincode install ${CC_PACKAGE_FILE} || true

echo "3. Installing Chaincode on Distributor Peer..."
set_org "Distributor"
"$PEER_BIN" lifecycle chaincode install ${CC_PACKAGE_FILE} || true

echo "4. Installing Chaincode on Pharmacy Peer..."
set_org "Pharmacy"
"$PEER_BIN" lifecycle chaincode install ${CC_PACKAGE_FILE} || true

set_org "Manufacturer"
CC_PACKAGE_ID=$("$PEER_BIN" lifecycle chaincode queryinstalled | grep "${CC_NAME}_${CC_VERSION}" | awk -F'Package ID: ' '{print $2}' | awk -F',' '{print $1}' | tail -n 1)
echo "Chaincode Package ID: ${CC_PACKAGE_ID}"

ORDERER_CA="$PWD/organizations/ordererOrganizations/coldchainrx.com/orderers/orderer.coldchainrx.com/tls/ca.crt"

echo "5. Approving Chaincode Definition for Manufacturer..."
set_org "Manufacturer"
"$PEER_BIN" lifecycle chaincode approveformyorg -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --channelID coldchainchannel --name ${CC_NAME} \
  --version ${CC_VERSION} --package-id ${CC_PACKAGE_ID} \
  --sequence ${CC_SEQUENCE} --tls --cafile "$ORDERER_CA"

echo "6. Approving Chaincode Definition for Distributor..."
set_org "Distributor"
"$PEER_BIN" lifecycle chaincode approveformyorg -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --channelID coldchainchannel --name ${CC_NAME} \
  --version ${CC_VERSION} --package-id ${CC_PACKAGE_ID} \
  --sequence ${CC_SEQUENCE} --tls --cafile "$ORDERER_CA"

echo "7. Approving Chaincode Definition for Pharmacy..."
set_org "Pharmacy"
"$PEER_BIN" lifecycle chaincode approveformyorg -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --channelID coldchainchannel --name ${CC_NAME} \
  --version ${CC_VERSION} --package-id ${CC_PACKAGE_ID} \
  --sequence ${CC_SEQUENCE} --tls --cafile "$ORDERER_CA"

echo "8. Committing Chaincode Definition to Channel..."
set_org "Manufacturer"
MANUFACTURER_CA="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/peers/peer0.manufacturer.coldchainrx.com/tls/ca.crt"
DISTRIBUTOR_CA="$PWD/organizations/peerOrganizations/distributor.coldchainrx.com/peers/peer0.distributor.coldchainrx.com/tls/ca.crt"
PHARMACY_CA="$PWD/organizations/peerOrganizations/pharmacy.coldchainrx.com/peers/peer0.pharmacy.coldchainrx.com/tls/ca.crt"

"$PEER_BIN" lifecycle chaincode commit -o orderer.coldchainrx.com:7050 \
  --ordererTLSHostnameOverride orderer.coldchainrx.com \
  --channelID coldchainchannel --name ${CC_NAME} \
  --version ${CC_VERSION} --sequence ${CC_SEQUENCE} \
  --tls --cafile "$ORDERER_CA" \
  --peerAddresses peer0.manufacturer.coldchainrx.com:7051 --tlsRootCertFiles "$MANUFACTURER_CA" \
  --peerAddresses peer0.distributor.coldchainrx.com:8051 --tlsRootCertFiles "$DISTRIBUTOR_CA" \
  --peerAddresses peer0.pharmacy.coldchainrx.com:9451 --tlsRootCertFiles "$PHARMACY_CA"

echo "9. Querying Committed Chaincode..."
"$PEER_BIN" lifecycle chaincode querycommitted --channelID coldchainchannel --name ${CC_NAME}

echo "=== Upgrade Successfully Completed! ==="
