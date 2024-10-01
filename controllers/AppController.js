import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  /**
   * Handles GET /status endpoint
   * Returns the connection status of MongoDB and Redis clients
   *
   * @param {import("express").Request} _req - Express request object (unused)
   * @param {import("express").Response} res - Express response object
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
   * Handles GET /stats endpoint
   * Retrieves the count of users and files from the database
   *
   * @param {import("express").Request} _req - Express request object (unused)
   * @param {import("express").Response} res - Express response object
   * @param {import("express").NextFunction} next - Express next middleware function
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
