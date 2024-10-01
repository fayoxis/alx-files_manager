import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (err) => console.error('Redis client error:', err));
    this.get = promisify(this.client.get).bind(this.client);
    this.set = promisify(this.client.set).bind(this.client);
    this.del = promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return this.client.connected;
  }

  async set(key, value, expireSeconds) {
    await this.set(key, value);
    this.client.expire(key, expireSeconds);
  }
}

const redisClient = new RedisClient();

export default redisClient;
