import { buildApp } from './server/app.js';
import { config } from './config.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server listening on port ${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/api/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
