const { spawn, execSync } = require('child_process');
const path = require('path');

console.log('==================================================');
console.log('🧊 ColdChainRx – Starting Blockchain & Backend Services');
console.log('==================================================');

// 1. Check Hyperledger Fabric Docker containers
function checkFabricNetwork() {
  try {
    const runningContainers = execSync('docker ps --format "{{.Names}}"', {
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf-8'
    });

    const isPeerRunning = runningContainers.includes('peer0.manufacturer.coldchainrx.com');
    const isOrdererRunning = runningContainers.includes('orderer.coldchainrx.com');

    if (isPeerRunning && isOrdererRunning) {
      console.log('⛓️  [Blockchain] ✅ Hyperledger Fabric network is active');
      console.log('   - Manufacturer Peer: localhost:7051');
      console.log('   - Orderer:           localhost:7050');
    } else {
      console.log('⛓️  [Blockchain] ⚠️  Fabric containers not detected. Attempting docker-compose up...');
      const composePath = path.resolve(__dirname, '../blockchain/network/docker/docker-compose.yaml');
      try {
        execSync(`docker compose -f "${composePath}" up -d`, { stdio: 'inherit' });
        console.log('⛓️  [Blockchain] ✅ Fabric containers started successfully.');
      } catch {
        execSync(`docker-compose -f "${composePath}" up -d`, { stdio: 'inherit' });
        console.log('⛓️  [Blockchain] ✅ Fabric containers started successfully.');
      }
    }
  } catch (err) {
    console.warn('⛓️  [Blockchain] ℹ️  Docker check skipped (Docker daemon may not be active):', err.message || err);
  }
}

checkFabricNetwork();
console.log('--------------------------------------------------');

// 2. Launch child processes
const children = [];

function spawnService(name, scriptPath, prefix, color) {
  const child = spawn(process.execPath, [scriptPath], {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.log(`${prefix} ${line}`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.error(`${prefix} [ERR] ${line}`);
      }
    });
  });

  child.on('exit', (code, signal) => {
    console.log(`${prefix} exited (code: ${code}, signal: ${signal})`);
  });

  children.push(child);
  return child;
}

// Start Fabric & IoT Gateway (Port 5000 + MQTT 1883)
const fabricServer = spawnService('Fabric Gateway', './src/server.js', '[Fabric:5000]');

// Start Web Proxy & Security Gateway (Port 3001)
const proxyServer = spawnService('Web Proxy', './server.js', '[Proxy:3001] ');

// 3. Graceful termination handler
function shutdown() {
  console.log('\n🛑 Shutting down ColdChainRx backend services...');
  children.forEach((child) => {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch (_) {}
  });
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  children.forEach((child) => {
    try {
      child.kill();
    } catch (_) {}
  });
});
