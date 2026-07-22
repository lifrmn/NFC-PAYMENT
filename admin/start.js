const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const dashboardUrl = 'http://localhost:4000/admin';
const healthUrl = 'http://127.0.0.1:4000/health';

// Periksa health endpoint dengan timeout satu detik; kegagalan jaringan dianggap backend belum siap.
const isBackendReady = () => new Promise(resolve => {
  const request = http.get(healthUrl, response => {
    response.resume();
    resolve(response.statusCode === 200);
  });
  request.setTimeout(1000, () => request.destroy());
  request.on('error', () => resolve(false));
});

// Buka dashboard melalui shell Windows tanpa menahan proses launcher Node.
const openDashboard = () => {
  console.log(`Dashboard: ${dashboardUrl}`);
  spawn('cmd.exe', ['/c', 'start', '', dashboardUrl], {
    detached: true,
    stdio: 'ignore'
  }).unref();
};

// Polling maksimal 30 kali setiap 500 ms memberi backend waktu startup sebelum dinyatakan gagal.
const waitForBackend = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isBackendReady()) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
};

// Gunakan backend yang sudah aktif atau spawn server lokal, lalu buka dashboard setelah health check lulus.
(async () => {
  if (await isBackendReady()) {
    console.log('Backend sudah aktif.');
    openDashboard();
    return;
  }

  console.log('Menyalakan backend...');
  const backend = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..', 'backend'),
    env: process.env,
    stdio: 'inherit'
  });

  let stopping = false;
  // Teruskan SIGINT dan SIGTERM ke child process agar backend tidak tertinggal setelah launcher dihentikan.
  const stopBackend = () => {
    stopping = true;
    backend.kill();
  };
  process.once('SIGINT', stopBackend);
  process.once('SIGTERM', stopBackend);

  if (!(await waitForBackend())) {
    console.error('Backend gagal aktif pada http://localhost:4000');
    stopBackend();
    process.exitCode = 1;
    return;
  }

  openDashboard();
  backend.on('exit', code => {
    process.exitCode = stopping ? 0 : (code ?? 0);
  });
})();