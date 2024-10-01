// Import the sha1 module for hashing passwords
import sha1 from 'sha1';
// Import the uuid module for generating unique tokens
import { v4 as uuidv4 } from 'uuid';
// Import the database client
import dbClient from '../utils/db';
// Import the Redis client
import redisClient from '../utils/redis';

class AuthController {
  // Method to handle user authentication
  static async getConnect(request, response) {
    // Get the Authorization header from the request
    const authData = request.header('Authorization');
    // Split the header to get the base64-encoded email and password
    let userEmail = authData.split(' ')[1];
    // Decode the base64-encoded email and password
    const buff = Buffer.from(userEmail, 'base64');
    userEmail = buff.toString('ascii');
    // Split the decoded string to get email and password
    const data = userEmail.split(':'); // contains email and password
    // Check if the email and password are present
    while (data.length !== 2) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // Hash the password using sha1
    const hashedPassword = sha1(data[1]);
    // Get the users collection from the database
    const users = dbClient.db.collection('users');
    // Find a user with the given email and hashed password
    users.findOne({ email: data[0], password: hashedPassword }, async (err, user) => {
      if (user) {
        // Generate a unique token for the user
        const token = uuidv4();
        // Create a key in Redis to store the user ID
        const key = `auth_${token}`;
        // Store the user ID in Redis with the key and an expiration time of 24 hours
        await redisClient.set(key, user._id.toString(), 60 * 60 * 24);
        // Send the token to the client
        response.status(200).json({ token });
      } else {
        // If the user is not found, send an unauthorized response
        response.status(401).json({ error: 'Unauthorized' });
      }
    });
  }

  // Method to handle user logout
  static async getDisconnect(request, response) {
    // Get the X-Token header from the request
    const token = request.header('X-Token');
    // Create the Redis key using the token
    const key = `auth_${token}`;
    // Get the user ID from Redis using the key
    const id = await redisClient.get(key);
    if (id) {
      // If the user ID is found, delete the key from Redis
      await redisClient.del(key);
      // Send a 204 No Content response
      response.status(204).json({});
    } else {
      // If the user ID is not found, send an unauthorized response
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

// Export the AuthController class
module.exports = AuthController;
