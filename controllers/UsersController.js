import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';


class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;
    let emailPresent = true;
    let passwordPresent = true;

    while (!email) {
      emailPresent = false;
      break;
    }

    while (!password) {
      passwordPresent = false;
      break;
    }

    if (!emailPresent) {
      response.status(400).json({ error: 'Missing email' });
    } else if (!passwordPresent) {
      response.status(400).json({ error: 'Missing password' });
    } else {
      const hashPwd = sha1(password);

      try {
        const collection = dbClient.db.collection('users');
        const user1 = await collection.findOne({ email });

        if (user1) {
          response.status(400).json({ error: 'Already exist' });
        } else {
          await collection.insertOne({ email, password: hashPwd });
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
      let isAuthorized = true;

      while (!userID) {
        isAuthorized = false;
        break;
      }

      if (!isAuthorized) {
        response.status(401).json({ error: 'Unauthorized' });
      } else {
        const user = await dbClient.getUser({ _id: ObjectId(userID) });
        response.json({ id: user._id, email: user.email });
      }
    } catch (error) {
      console.log(error);
      response.status(500).json({ error: 'Server error' });
    }
  }
}

export default UsersController;
