import { expect, use, request } from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { ObjectId } from 'mongodb';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);

describe('User Endpoints', () => {
  const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';
  let token = '';
  let userId = '';
  const user = { email: 'bob@dylan.com', password: 'toto1234!' };

  before(async () => {
    await redisClient.client.flushall('ASYNC');
    await dbClient.usersCollection.deleteMany({});
    await dbClient.filesCollection.deleteMany({});
  });

  after(async () => {
    await redisClient.client.flushall('ASYNC');
    await dbClient.usersCollection.deleteMany({});
    await dbClient.filesCollection.deleteMany({});
  });

  describe('POST /users', () => {
    it('creates user successfully', async () => {
      const res = await request(app).post('/users').send(user);
      expect(res.statusCode).to.equal(201);
      expect(res.body.email).to.equal(user.email);
      expect(res.body).to.have.property('id');
      userId = res.body.id;
      const userMongo = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
      expect(userMongo).to.exist;
    });

    it('fails without password', async () => {
      const res = await request(app).post('/users').send({ email: user.email });
      expect(res.statusCode).to.equal(400);
      expect(res.body).to.eql({ error: 'Missing password' });
    });

    it('fails without email', async () => {
      const res = await request(app).post('/users').send({ password: user.password });
      expect(res.statusCode).to.equal(400);
      expect(res.body).to.eql({ error: 'Missing email' });
    });

    it('fails for existing user', async () => {
      const res = await request(app).post('/users').send(user);
      expect(res.statusCode).to.equal(400);
      expect(res.body).to.eql({ error: 'Already exist' });
    });
  });

  describe('GET /connect', () => {
    it('fails without credentials', async () => {
      const res = await request(app).get('/connect');
      expect(res.statusCode).to.equal(401);
      expect(res.body).to.eql({ error: 'Unauthorized' });
    });

    it('succeeds with valid credentials', async () => {
      const spyRedisSet = sinon.spy(redisClient, 'set');
      const res = await request(app).get('/connect').set('Authorization', credentials);
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.have.property('token');
      token = res.body.token;
      expect(spyRedisSet.calledOnceWithExactly(`auth_${token}`, userId, 24 * 3600)).to.be.true;
      spyRedisSet.restore();
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.exist;
    });
  });

  describe('GET /disconnect', () => {
    it('fails without token', async () => {
      const res = await request(app).get('/disconnect');
      expect(res.statusCode).to.equal(401);
      expect(res.body).to.eql({ error: 'Unauthorized' });
    });

    it('succeeds with valid token', async () => {
      const res = await request(app).get('/disconnect').set('X-Token', token);
      expect(res.statusCode).to.equal(204);
      expect(res.text).to.be.empty;
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.not.exist;
    });
  });

  describe('GET /users/me', () => {
    before(async () => {
      const res = await request(app).get('/connect').set('Authorization', credentials);
      token = res.body.token;
    });

    it('fails without token', async () => {
      const res = await request(app).get('/users/me');
      expect(res.statusCode).to.equal(401);
      expect(res.body).to.eql({ error: 'Unauthorized' });
    });

    it('succeeds with valid token', async () => {
      const res = await request(app).get('/users/me').set('X-Token', token);
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.eql({ id: userId, email: user.email });
    });
  });
});
