#!/bin/bash
set -e

echo "Starting ColdChainRx Network Bootstrapping..."

CONFIGTXGEN="$PWD/../../bin/configtxgen"
OSNADMIN="$PWD/../../bin/osnadmin"
PEER_BIN="$PWD/../../bin/peer"

# 1. Clean previous artifacts
echo "Cleaning up previous artifacts..."
rm -f channel-artifacts/*

# 2. Generate application channel block
echo "Generating channel genesis block..."
FABRIC_CFG_PATH="$PWD" "$CONFIGTXGEN" -profile ColdChainRxChannel -outputBlock ./channel-artifacts/coldchainchannel.block -channelID coldchainchannel

# 3. Create docker network if it doesn't exist
if ! docker network ls | grep -q coldchainrx; then
  echo "Creating docker network 'coldchainrx'..."
  docker network create coldchainrx
fi

# 4. Bring up containers
echo "Starting docker containers..."
docker-compose -f docker/docker-compose.yaml up -d

# Wait for containers to boot
sleep 5

# 5. Join orderer to the channel
echo "Joining orderer to the channel..."
ORDERER_ADMIN_TLS_SIGN_CERT="$PWD/organizations/ordererOrganizations/coldchainrx.com/orderers/orderer.coldchainrx.com/tls/server.crt"
ORDERER_ADMIN_TLS_PRIVATE_KEY="$PWD/organizations/ordererOrganizations/coldchainrx.com/orderers/orderer.coldchainrx.com/tls/server.key"
ORDERER_CA="$PWD/organizations/ordererOrganizations/coldchainrx.com/orderers/orderer.coldchainrx.com/tls/ca.crt"

"$OSNADMIN" channel join --channelID coldchainchannel --config-block ./channel-artifacts/coldchainchannel.block -o orderer.coldchainrx.com:7053 --ca-file "$ORDERER_CA" --client-cert "$ORDERER_ADMIN_TLS_SIGN_CERT" --client-key "$ORDERER_ADMIN_TLS_PRIVATE_KEY"

# 6. Join peers to the channel
export FABRIC_CFG_PATH="$PWD/../../config"

echo "Joining Manufacturer Peer to the channel..."
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="ManufacturerMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/peers/peer0.manufacturer.coldchainrx.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/manufacturer.coldchainrx.com/users/Admin@manufacturer.coldchainrx.com/msp"
export CORE_PEER_ADDRESS=peer0.manufacturer.coldchainrx.com:7051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.manufacturer.coldchainrx.com

"$PEER_BIN" channel join -b ./channel-artifacts/coldchainchannel.block

echo "Joining Distributor Peer to the channel..."
export CORE_PEER_LOCALMSPID="DistributorMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$PWD/organizations/peerOrganizations/distributor.coldchainrx.com/peers/peer0.distributor.coldchainrx.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/distributor.coldchainrx.com/users/Admin@distributor.coldchainrx.com/msp"
export CORE_PEER_ADDRESS=peer0.distributor.coldchainrx.com:8051
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.distributor.coldchainrx.com

"$PEER_BIN" channel join -b ./channel-artifacts/coldchainchannel.block

echo "Joining Pharmacy Peer to the channel..."
export CORE_PEER_LOCALMSPID="PharmacyMSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$PWD/organizations/peerOrganizations/pharmacy.coldchainrx.com/peers/peer0.pharmacy.coldchainrx.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$PWD/organizations/peerOrganizations/pharmacy.coldchainrx.com/users/Admin@pharmacy.coldchainrx.com/msp"
export CORE_PEER_ADDRESS=peer0.pharmacy.coldchainrx.com:9451
export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.pharmacy.coldchainrx.com

"$PEER_BIN" channel join -b ./channel-artifacts/coldchainchannel.block

echo "Network bootstrapping complete!"
