import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  /**
   * Controller for endpoint GET /status
   * Retrieves MongoDB client and Redis client connection status
   *
   * @param {import("express").Request} _req - Request object
   * @param {import("express").Response} res - Response object
   */
  static getStatus(_req, res) {
    const mongodbStatus = dbClient.isAlive();
    const redisStatus = redisClient.isAlive();

    if (mongodbStatus && redisStatus) {
      res.status(200).json({ redis: true, db: true });
    } else {
      res.status(500).json({ redis: redisStatus, db: mongodbStatus });
    }
  }

  /**
   * Controller for endpoint GET /stats
   * Retrieves the count of users and files
   *
   * @param {import("express").Request} _req - Request object
   * @param {import("express").Response} res - Response object
   * @param {import("express").NextFunction} next - Next function
   */
  static async getStats(_req, res, next) {
    try {
      const users = await dbClient.nbUsers();
      const files = await dbClient.nbFiles();
      res.status(200).json({ users, files });
    } catch (err) {
      next(err);
    }
  }
}

export default AppController;
