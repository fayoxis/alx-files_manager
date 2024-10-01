import { createClient } from 'redis';
import { promisify } from 'util';

/**
 * RedisClient class for interacting with a Redis server.
 */
class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (error) => {
      console.log(`Redis client not connected to server: ${error}`);
    });
  }

  /**
   * Checks if the Redis client is connected to the server.
   * @returns {boolean} True if connected, false otherwise.
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Retrieves the value associated with the given key
   * from the Redis server.
   * @param {string} key - The key to retrieve the value for.
   * @returns {Promise<string|null>} The value associated
   * with the key, or null if the key doesn't exist.
   */
  async get(key) {
    const redisGet = promisify(this.client.get).bind(this.client);
    const value = await redisGet(key);
    return value;
  }

  /**
   * Stores a key-value pair in the Redis server with an
   * optional expiration time.
   * @param {string} key - The key to associate the value with.
   * @param {string} value - The value to store.
   * @param {number} [expireSeconds] - The number of seconds after
   * which the key-value pair should expire. If not provided,
   * the pair won't expire.
   */
  async set(key, value, expireSeconds) {
    const redisSet = promisify(this.client.set).bind(this.client);
    await redisSet(key, value);

    if (expireSeconds) {
      await this.client.expire(key, expireSeconds);
    }
  }

  /**
   * Removes a key-value pair from the Redis server.
   * @param {string} key - The key to remove.
   */
  async del(key) {
    const redisDel = promisify(this.client.del).bind(this.client);
    await redisDel(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
