// The code tests the following:
// GET /status**
//  Checks that the endpoint returns the correct connection status 
//  for Redis and MongoDB.
//  Expects a response body of `{ redis: true, db: true }` 
//   and a status code of `200`.
//
//  GET /stats**
//   When empty**: Verifies that the endpoint returns `0` 
//   users and `0` files when the database is empty. Expects 
//   { users: 0, files: 0 }` and a status code of `200`.
//   After adding data**: Ensures that the endpoint returns 
//   the correct counts after inserting one user and two files. 
//   Expects `{ users: 1, files: 2 }` and a status code of `200`.
import { expect, use, request } from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import dbClient from '../utils/db';

use(chaiHttp);

describe('App Status Endpoints', () => {
  it('GET /status returns redis and mongo connection status', async () => {
    const res = await request(app).get('/status');
    expect(res.body).to.eql({ redis: true, db: true });
    expect(res.status).to.equal(200);
  });

  describe('GET /stats', () => {
    beforeEach(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });

    it('returns 0 users and files when empty', async () => {
      const res = await request(app).get('/stats');
      expect(res.body).to.eql({ users: 0, files: 0 });
      expect(res.status).to.equal(200);
    });

    it('returns correct user and file count', async () => {
      await dbClient.usersCollection.insertOne({ name: 'Larry' });
      await dbClient.filesCollection.insertMany([{ name: 'image.png' }, { name: 'file.txt' }]);

      const res = await request(app).get('/stats');
      expect(res.body).to.eql({ users: 1, files: 2 });
      expect(res.status).to.equal(200);
    });
  });
});
