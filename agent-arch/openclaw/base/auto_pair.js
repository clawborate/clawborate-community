// Auto-approve Control UI pairing requests from the Docker host.
// Security: only approves remoteIp within the same /24 subnet as host.docker.internal.
// Uses fs.watch for instant approval on pending.json change, plus 1s polling fallback.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const PENDING_PATH = '/home/node/.openclaw/devices/pending.json';

function getHostSubnet() {
  try {
    const result = spawnSync('getent', ['hosts', 'host.docker.internal'], { encoding: 'utf8' });
    const ip = (result.stdout || '').trim().split(/\s+/)[0];
    if (!ip) return null;
    return ip.split('.').slice(0, 3).join('.') + '.';
  } catch (e) { return null; }
}

function approveHostPending(subnet) {
  try {
    const raw = fs.readFileSync(PENDING_PATH, 'utf8');
    const pending = JSON.parse(raw);
    Object.values(pending).forEach(r => {
      if (r.remoteIp && r.remoteIp.startsWith(subnet)) {
        try {
          execSync('openclaw devices approve ' + r.requestId, { stdio: 'ignore' });
        } catch (e) {
          // Approve command failed — worth surfacing because it indicates a real
          // problem (openclaw CLI missing, request already consumed, etc.). Goes
          // to the agent container's stderr, viewable via `docker logs`.
          console.error('[auto-pair] approve failed for', r.requestId, '-', e.message);
        }
      }
    });
  } catch (e) {
    // Outer catch: ENOENT is the normal idle state (no pending.json yet) and
    // fires every poll cycle, so do not log it. Anything else (parse error,
    // permission denied, IO error) is unusual and worth knowing about.
    if (e.code !== 'ENOENT') {
      console.error('[auto-pair] read/parse failed:', e.message);
    }
  }
}

const subnet = getHostSubnet();
if (!subnet) process.exit(1);

// Instant approval via fs.watch — fires within ms of pairing request hitting disk
try {
  fs.watch(PENDING_PATH, { persistent: true }, () => approveHostPending(subnet));
} catch (e) {
  // fs.watch may fail if file doesn't exist yet; polling fallback handles it
}

// 1s polling fallback: covers fs.watch gaps and the case where file didn't exist at startup
setInterval(() => approveHostPending(subnet), 1000);

// Approve any already-pending requests on startup
approveHostPending(subnet);
