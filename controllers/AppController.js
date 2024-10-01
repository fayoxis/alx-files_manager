import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  /**
   * Controller for endpoint GET /status that retrieves
   * mongodb client and redis client connection status
   * @typedef {import("express").Request} Request
   * @typedef {import("express").Response} Response
   * @param {Request} _req - request object
   * @param {Response} res  - response object
   */
  static getStatus(_req, res) {
    let isAlive = false;
    let iteration = 0;
    const maxIterations = 10;

    while (!isAlive && iteration < maxIterations) {
      if (dbClient.isAlive() && redisClient.isAlive()) {
        isAlive = true;
        res.status(200).json({ redis: true, db: true });
      }
      iteration++;
    }

    if (!isAlive) {
      res.status(500).json({ error: 'Unable to establish connection' });
    }
  }

  /**
   * Controller for endpoint GET /stats that retrieves
   * count of users and files
   * @param {Request} _req - Request object
   * @param {Response} res  - Response object
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
