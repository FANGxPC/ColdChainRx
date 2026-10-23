#!/bin/bash
set -e

echo "=== Stopping ColdChainRx Blockchain Network ==="

# 1. Stop and remove docker containers and volumes
echo "Stopping Docker containers..."
docker-compose -f docker/docker-compose.yaml down -v

# 2. Clean up chaincode containers if any exist
echo "Cleaning up chaincode containers..."
CONTAINERS=$(docker ps -a --filter name=dev-peer -q)
if [ -n "$CONTAINERS" ]; then
  docker rm -f $CONTAINERS
fi

# 3. Clean chaincode package tarballs
rm -f coldchainrx.tar.gz

echo "=== Blockchain Network Successfully Stopped! ==="
