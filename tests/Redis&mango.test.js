// For the Redis client:
// It tests the isAlive() method
// It checks the get() method for a non-existent key
// It tests the set() method to add a key-value pair with expiration
// It verifies that the key expires after the set time

// For the database client:
// It tests the isAlive() method
// It checks the nbUsers() method to count user documents
// It verifies the nbFiles() method to count file documents
import { expect, use, should } from 'chai';
import chaiHttp from 'chai-http';
import { promisify } from 'util';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

describe('testing the clients', () => {
  describe('redis Client', () => {
    before(async () => await redisClient.client.flushall('ASYNC'));
    after(async () => await redisClient.client.flushall('ASYNC'));

    it('shows connection is alive', async () => expect(redisClient.isAlive()).to.equal(true));
    it('returns key as null', async () => expect(await redisClient.get('myKey')).to.equal(null));
    it('set key without issue', async () => expect(await redisClient.set('myKey', 12, 1)).to.equal(undefined));
    it('returns key with null after expiry', async () => {
      const sleep = promisify(setTimeout);
      await sleep(1100);
      expect(await redisClient.get('myKey')).to.equal(null);
    });
  });

  describe('db Client', () => {
    before(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });
    after(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });

    it('shows connection is alive', () => expect(dbClient.isAlive()).to.equal(true));
    it('shows number of user documents', async () => {
      await dbClient.usersCollection.deleteMany({});
      expect(await dbClient.nbUsers()).to.equal(0);
      await dbClient.usersCollection.insertOne({ name: 'Larry' });
      await dbClient.usersCollection.insertOne({ name: 'Karla' });
      expect(await dbClient.nbUsers()).to.equal(2);
    });
    it('shows number of file documents', async () => {
      await dbClient.filesCollection.deleteMany({});
      expect(await dbClient.nbFiles()).to.equal(0);
      await dbClient.filesCollection.insertOne({ name: 'FileOne' });
      await dbClient.filesCollection.insertOne({ name: 'FileTwo' });
      expect(await dbClient.nbUsers()).to.equal(2);
    });
  });
});
