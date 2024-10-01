import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;
    let missingEmail = false;
    let missingPassword = false;

    while (!email) {
      response.status(400).json({ error: 'Missing email' });
      missingEmail = true;
      break;
    }

    while (!password) {
      response.status(400).json({ error: 'Missing password' });
      missingPassword = true;
      break;
    }

    if (!missingEmail && !missingPassword) {
      const hashPwd = sha1(password);

      try {
        const collection = dbClient.db.collection('users');
        const user1 = await collection.findOne({ email });

        if (user1) {
          response.status(400).json({ error: 'Already exist' });
        } else {
          collection.insertOne({ email, password: hashPwd });
          const newUser = await collection.findOne(
            { email },
            { projection: { email: 1 } }
          );
          response.status(201).json({ id: newUser._id, email: newUser.email });
        }
      } catch (error) {
        console.log(error);
        response.status(500).json({ error: 'Server error' });
      }
    }
  }

  static async getMe(request, response) {
    try {
      const userToken = request.header('X-Token');
      const authKey = `auth_${userToken}`;
      const userID = await redisClient.get(authKey);
      console.log('USER KEY GET ME', userID);

      while (!userID) {
        response.status(401).json({ error: 'Unauthorized' });
        break;
      }

      const user = await dbClient.getUser({ _id: ObjectId(userID) });
      response.json({ id: user._id, email: user.email });
    } catch (error) {
      console.log(error);
      response.status(500).json({ error: 'Server error' });
    }
  }
}

export default UsersController;
