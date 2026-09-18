import { createServer } from 'node:http';
import { createApp } from './app';
import { assertProductionConfig, config } from './config';
import { createSocketServer } from './realtime/socketServer';

assertProductionConfig();

const app = createApp();
const httpServer = createServer(app);

createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`[api] http + socket.io listening on http://localhost:${config.port} (${config.nodeEnv})`);
});
