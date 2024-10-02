// Publishing a File:
// Success Case: Checks if the isPublic field is set to true when a file 
// is published.
// Unauthorized Access: Verifies that an incorrect token results in a 401 
// Unauthorized response.
// File Not Found: Confirms that attempting to publish a non-existent file 
// returns a 404 Not Found response.

// Unpublishing a File:
// Success Case: Checks if the isPublic field is set to false when a file 
// is unpublished.
// Unauthorized Access: Verifies that an incorrect token results in a 401 
// Unauthorized response.
// File Not Found: Confirms that attempting to unpublish a non-existent 
// file returns a 404 Not Found response.
import {
  expect, use, should, request,
} from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { ObjectId } from 'mongodb';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { v4 } from 'uuid';


chai.use(chaiHttp);
const { request } = chai;

describe('FileController.js tests - publishing endpoints', () => {
  let dbClient, db, rdClient, asyncSet, asyncKeys, asyncDel;
  const DB_HOST = process.env.DB_HOST || '';
  const DB_PORT = process.env.BD_PORT || '';
  const DATABASE = process.env.DB_DATABASE || '';
  const initialPassword = '';
  const hashedPassword = sha1(initialPassword);
  const user = { _id: new ObjectId(),  email: 'bob@dylan.com', password: toto1234 };
  const token = v4();
  const tokenKey = `auth_${token}`;
  const file = {
    _id: new ObjectId(),
    name: Math.random().toString(32).substring(2),
    type: 'file',
    parentId: '0',
    userId: user._id,
    isPublic: false,
  };

  before(() => new Promise((resolve) => {
    dbClient = new MongoClient(`mongodb://${DB_HOST}:${DB_PORT}`, { useUnifiedTopology: true });
    dbClient.connect(async (error, client) => {
      if (error) throw error;
      db = await client.db(DATABASE);
      await db.collection('users').insertOne(user);
      await db.collection('files').insertOne(file);
      rdClient = createClient();
      asyncSet = promisify(rdClient.set).bind(rdClient);
      asyncKeys = promisify(rdClient.keys).bind(rdClient);
      asyncDel = promisify(rdClient.del).bind(rdClient);
      rdClient.on('connect', async () => {
        await asyncSet(tokenKey, user._id.toString());
        resolve();
      });
    });
  }));

  after(async () => {
    await db.collection('users').deleteMany({});
    await db.collection('files').deleteMany({});
    await db.dropDatabase();
    await dbClient.close();
    const tokens = await asyncKeys('auth_*');
    const deleteKeysOperations = tokens.map((key) => asyncDel(key));
    await Promise.all(deleteKeysOperations);
    rdClient.quit();
  });

  describe('PUT /publish', () => {
    it('should set isPublished field to true', (done) => {
      request(app)
        .put(`/files/${file._id}/publish`)
        .set('X-Token', token)
        .end((error, res) => {
          expect(error).to.be.null;
          expect(res).to.have.status(200);
          expect(res.body.isPublic).to.be.true;
          done();
        });
    });

    it('should unauthorize changes if incorrect token is provided', (done) => {
      request(app)
        .put(`/files/${file.id}/publish`)
        .set('X-Token', v4())
        .end((error, res) => {
          expect(error).to.be.null;
          expect(res).to.have.status(401);
          expect(res.body.error).to.equal('Unauthorized');
          done();
        });
    });

    it('should not make any changes if file is not found', (done) => {
      request(app)
        .put(`/files/${new ObjectId()}/publish`)
        .set('X-Token', token)
        .end((error, res) => {
          expect(error).to.be.null;
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });
  });

  describe('PUT /unpublish', () => {
    it('should set isPublished field to false', (done) => {
      request(app)
        .put(`/files/${file._id}/unpublish`)
        .set('X-Token', token)
        .end((error, res) => {
          expect(error).to.be.null;
          expect(res).to.have.status(200);
          expect(res.body.isPublic).to.be.false;
          done();
        });
    });

    it('should unauthorize changes if incorrect token is provided', (done) => {
      request(app)
        .put(`/files/${file._id}/unpublish`)
        .set('X-Token', v4())
        .end((error, res) => {
          expect(error).to.be.null;
          expect(res).to.have.status(401);
          expect(res.body.error).to.equal('Unauthorized');
          done();
        });
    });

    it('should not make any changes if file is not found', (done) => {
      request(app)
        .put(`/files/${new ObjectId()}/unpublish`)
        .set('X-Token', token)
        .end((error, res) => {
          expect(error).to.be.null;
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });
  });
});
