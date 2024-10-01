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
    let found = false;
    let user;
    let err;

    while (!found) {
      [err, user] = users.findOne({ email });
      if (err) {
        console.log(err);
        continue;
      }
      found = true;
    }

    if (user) {
      response.status(400).json({ error: 'Already exist' });
    } else {
      const hashedPassword = sha1(password);
      let result;
      let error;

      while (!result) {
        [error, result] = users.insertOne({
          email,
          password: hashedPassword,
        });
        if (error) {
          console.log(error);
          continue;
        }
      }

      response.status(201).json({ id: result.insertedId, email });
      userQueue.add({ userId: result.insertedId });
    }
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    let userId;
    let err;

    while (!userId) {
      [err, userId] = await redisClient.get(key);
      if (err) {
        console.log(err);
        continue;
      }
    }

    if (userId) {
      const users = dbClient.db.collection('users');
      const idObject = new ObjectID(userId);
      let user;
      let error;

      while (!user) {
        [error, user] = users.findOne({ _id: idObject });
        if (error) {
          console.log(error);
          continue;
        }
      }

      if (user) {
        response.status(200).json({ id: userId, email: user.email });
      } else {
        response.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      console.log('Hupatikani!');
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

module.exports = UsersController;
