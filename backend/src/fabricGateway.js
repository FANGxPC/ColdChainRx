const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
require('dotenv').config();

// Override DNS resolution for Fabric Docker hostnames on localhost
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (
    hostname === 'peer0.manufacturer.coldchainrx.com' ||
    hostname === 'peer0.distributor.coldchainrx.com' ||
    hostname === 'peer0.pharmacy.coldchainrx.com' ||
    hostname === 'orderer.coldchainrx.com'
  ) {
    return callback(null, '127.0.0.1', 4);
  }
  return originalLookup(hostname, options, callback);
};

const channelName = process.env.CHANNEL_NAME || 'coldchainchannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'coldchainrx';
const mspId = process.env.MSP_ID || 'ManufacturerMSP';

const peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';
const peerHostAlias = process.env.PEER_HOST_ALIAS || 'peer0.manufacturer.coldchainrx.com';

const certPath = path.resolve(__dirname, '..', process.env.CERT_PATH);
const keyPath = path.resolve(__dirname, '..', process.env.KEY_PATH);
const tlsCertPath = path.resolve(__dirname, '..', process.env.TLS_CERT_PATH);

async function newGrpcClient() {
  const tlsRootCert = fs.readFileSync(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostAlias,
    'grpc.max_receive_message_length': 64 * 1024 * 1024, // 64 MB safeguard
    'grpc.max_send_message_length': 64 * 1024 * 1024,
  });
}

async function newIdentity() {
  const credentials = fs.readFileSync(certPath);
  return { mspId, credentials };
}

async function newSigner() {
  const privateKeyPem = fs.readFileSync(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

async function getContract() {
  const client = await newGrpcClient();
  const gateway = connect({
    client,
    identity: await newIdentity(),
    signer: await newSigner(),
    evaluateOptions: () => ({ timeout: 5000 }),
    endorseOptions: () => ({ timeout: 15000 }),
    submitOptions: () => ({ timeout: 15000 }),
    commitStatusOptions: () => ({ timeout: 15000 }),
  });

  const network = gateway.getNetwork(channelName);
  const contract = network.getContract(chaincodeName);

  return { contract, gateway, client };
}

module.exports = { getContract };
