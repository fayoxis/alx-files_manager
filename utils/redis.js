import { createClient } from 'redis';
import { promisify } from 'util';

// the Redis client class with common methods
class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (error) => {
      console.log(`Redis client not connected to server: ${error}`);
    });
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  // this Checks if the Redis client is connected
  isAlive() {
    return this.client.connected;
  }

  // it Retrieve the value associated with the given key
  async get(key) {
    return await this.getAsync(key);
  }

  // this Sets a key-value pair with an expiration time
  async set(key, value, time) {
    await this.setAsync(key, value);
    await this.client.expire(key, time);
  }

  // this Removes the key-value pair associated with the given key
  async del(key) {
    await this.delAsync(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
