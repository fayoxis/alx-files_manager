// Import the MongoClient from the 'mongodb' package
import { MongoClient } from 'mongodb';

// Set the host and port for the MongoDB connection
const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${host}:${port}/`;

// Define a class for interacting with the MongoDB database
class DBClient {
  constructor() {
    this.db = null;
    // Connect to the MongoDB server
    MongoClient.connect(url, { useUnifiedTopology: true }, (error, client) => {
      if (error) console.log(error);
      this.db = client.db(database);
      // Create the 'users' and 'files' collections if they don't exist
      this.db.createCollection('users');
      this.db.createCollection('files');
    });
  }

  // Check if the database connection is alive
  isAlive() {
    return !!this.db;
  }

  // Get the number of users in the 'users' collection
  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  // Get a user document from the 'users' collection based on a query
  async getUser(query) {
    console.log('QUERY IN DB.JS', query);
    const user = await this.db.collection('users').findOne(query);
    console.log('GET USER IN DB.JS', user);
    return user;
  }

  // Get the number of files in the 'files' collection
  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

// Create an instance of the DBClient class
const dbClient = new DBClient();
export default dbClient;
