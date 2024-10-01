import sha1 from 'sha1';
import { ObjectID } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

class UsersController {
  static postNew(request, response) {
    const { email } = request.body;
    const { password } = request.body;

    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    const users = dbClient.db.collection('users');
    let user;
    let err;

    while (!user) {
      [err, user] = users.findOne({ email });
      if (err) {
        console.log(err);
        break;
      }
      if (user) {
        response.status(400).json({ error: 'Already exist' });
        break;
      }
      const hashedPassword = sha1(password);
      const result = users.insertOne({
        email,
        password: hashedPassword,
      });
      if (result.insertedId) {
        response.status(201).json({ id: result.insertedId, email });
        userQueue.add({ userId: result.insertedId });
        break;
      }
    }
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    let userId;

    while (!userId) {
      userId = await redisClient.get(key);
      if (userId) {
        const users = dbClient.db.collection('users');
        const idObject = new ObjectID(userId);
        let user;
        let err;

        while (!user) {
          [err, user] = users.findOne({ _id: idObject });
          if (err) {
            console.log(err);
            break;
          }
          if (user) {
            response.status(200).json({ id: userId, email: user.email });
            break;
          }
          response.status(401).json({ error: 'Unauthorized' });
          break;
        }
        break;
      }
      console.log('Hupatikani!');
      response.status(401).json({ error: 'Unauthorized' });
      break;
    }
  }
}

module.exports = UsersController;
