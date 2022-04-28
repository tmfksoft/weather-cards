import { createClient } from 'redis';
import config from 'vault-config';

const client = createClient({
    ...config.get('servers.redis')
});
client.connect();

export default client;