import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function waitForApi() {
  const base = process.env.API_URL ?? 'http://localhost:3000/api';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/province`);
      if (response.ok) return;
    } catch {
      // The API is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('API did not become ready within 60 seconds');
}

run(dockerCommand, ['compose', 'exec', '-T', 'api', 'npx', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']);
const seedCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const seedDatabaseUrl = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/tourist_map?schema=public';
run(seedCommand, ['run', 'db:seed'], { env: { ...process.env, DATABASE_URL: seedDatabaseUrl } });
run(dockerCommand, ['compose', 'restart', 'api']);
await waitForApi();
run(process.execPath, ['test/e2e.mjs']);
