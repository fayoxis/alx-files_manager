// Import the sha1 module for hashing passwords
import sha1 from 'sha1';
// Import the ObjectID class from the mongodb library
import { ObjectID } from 'mongodb';
// Import the Bull library for job queues
import Queue from 'bull';
// Import the database client
import dbClient from '../utils/db';
// Import the Redis client
import redisClient from '../utils/redis';

// Create a new job queue named 'userQueue' using Redis
const userQueue = new Queue('userQueue', 'redis://127.0.0.1:8080');

class UsersController {
  // Method for creating a new user
  static postNew(request, response) {
    // Get the email and password from the request body
    const { email } = request.body;
    const { password } = request.body;

    // Check if email is missing
    while (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    // Check if password is missing
    while (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    // Get the 'users' collection from the database
    const users = dbClient.db.collection('users');
    // Check if the email already exists in the database
    users.findOne({ email }, (err, user) => {
      if (user) {
        // If the email already exists, return an error
        response.status(400).json({ error: 'Already exist' });
      } else {
        // If the email doesn't exist, hash the password
        const hashedPassword = sha1(password);
        // Insert the new user into the database
        users.insertOne(
          {
            email,
            password: hashedPassword,
          },
        ).then((result) => {
          // If the insertion is successful, return the user ID and email
          response.status(201).json({ id: result.insertedId, email });
          // Add a new job to the userQueue with the user ID
          userQueue.add({ userId: result.insertedId });
        }).catch((error) => console.log(error));
      }
    });
  }

  // Method for getting the user's information
  static async getMe(request, response) {
    // Get the token from the request header
    const token = request.header('X-Token');
    // Construct the key for Redis based on the token
    const key = `auth_${token}`;
    // Get the user ID from Redis using the key
    const userId = await redisClient.get(key);
    if (userId) {
      // If the user ID is found in Redis
      const users = dbClient.db.collection('users');
      // Convert the user ID to an ObjectID
      const idObject = new ObjectID(userId);
      // Find the user in the database using the ObjectID
      users.findOne({ _id: idObject }, (err, user) => {
        if (user) {
          // If the user is found, return the user ID and email
          response.status(200).json({ id: userId, email: user.email });
        } else {
          // If the user is not found, return an unauthorized error
          response.status(401).json({ error: 'Unauthorized' });
        }
      });
    } else {
      // If the user ID is not found in Redis, return an unauthorized error
      console.log('Hupatikani!');
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

// Export the UsersController class
module.exports = UsersController;
