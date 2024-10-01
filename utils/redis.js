import { createClient } from 'redis';
import { promisify } from 'util';

// Class to define methods for commonly used Redis commands
class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (error) => {
      console.log(`Redis client not connected to server: ${error}`);
    });
  }

  // Check connection status and report
  isAlive() {
    return this.client.connected;
  }

  // Get value for a given key from the Redis server
  async get(key) {
    const redisGet = promisify(this.client.get).bind(this.client);
    const value = await redisGet(key);
    return value;
  }

  // Set a key-value pair in the Redis server with an optional expiration time
  async set(key, value, expireSeconds) {
    const redisSet = promisify(this.client.set).bind(this.client);
    await redisSet(key, value);

    if (expireSeconds) {
      await this.client.expire(key, expireSeconds);
    }
  }

  // Remove a key-value pair from the Redis server
  async del(key) {
    const redisDel = promisify(this.client.del).bind(this.client);
    await redisDel(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
