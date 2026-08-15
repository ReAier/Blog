import { buildServer } from './app';
import { createAdminConfig } from './config';

const config = createAdminConfig();
const server = await buildServer({ config });
await server.listen({ host: config.host, port: config.port });
