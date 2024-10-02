// 1. GET /files/:id
// Valid Token: Returns file details with a valid token.
// Invalid Token: Returns 401 for invalid tokens.
// File Not Found: Returns 404 if the file doesn't exist.
//
// 2. GET /files/:id/data
// Public File Access: Allows access to public files.
// Private File Access: Users access their own private files.
// Unauthorized Access: No access to others' private files.
// Folder Access: 400 error on folder data access.
//
// 3. GET /files
// Implicit Parameters: Defaults to parentId=0 and page=0.
// Explicit Parent ID: Fetch files with specified parentId.
// Pagination: Validates pagination, includes empty list for out-of-range pages.
// No Files: Returns an empty list if no files exist.
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
const { expect, request } = chai;

describe('FileController.js tests', () => {
  let dbClient, db, rdClient, asyncSet, asyncKeys, asyncDel;
  const DB_HOST = process.env.DB_HOST || '';
  const DB_PORT = process.env.BD_PORT || ;
  const DATABASE = process.env.DB_DATABASE || '';
  const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
  const MAX_PAGE_SIZE = '';
  const initialPassword = '';
  const hashedPassword = sha1(initialPassword);
  const userOne = { _id: new ObjectId(), email: 'bob@dylan.com', password: toto1234 };
  const userTwo = { _id: new ObjectId(), email: 'bob@dylan.com', password: toto1234 };
  const userOneToken = v4();
  const userTwoToken = v4();
  const userOneTokenKey = `auth_${userOneToken}`;
  const userTwoTokenKey = `auth_${userTwoToken}`;

  const folders = [], files = [];
  const randomString = () => Math.random().toString(32).substring(2);

  before(() => new Promise(async (resolve) => {
    dbClient = new MongoClient(`mongodb://${DB_HOST}:${DB_PORT}`, { useUnifiedTopology: true });
    await dbClient.connect();
    db = dbClient.db(DATABASE);
    await db.collection('users').deleteMany({});
    await db.collection('users').insertMany([userOne, userTwo]);

    for (let i = 0; i < 10; i++) {
      const newFolder = {
        _id: new ObjectId(),
        name: randomString(),
        type: 'folder',
        parentId: '0',
        userId: userOne._id,
        isPublic: !!(i % 2),
      };
      folders.push(newFolder);
    }
    for (let i = 0; i < 25; i++) {
      const newFile = {
        _id: new ObjectId(),
        name: `${randomString()}.txt`,
        type: 'file',
        parentId: folders[0]._id,
        userId: userOne._id,
        isPublic: !!(i % 2),
        localPath: path.join(FOLDER_PATH, v4()),
      };
      files.push(newFile);
    }
    await db.collection('files').insertMany(folders);
    await db.collection('files').insertMany(files);

    const publicFile = files.find(file => file.isPublic);
    const privateFile = files.find(file => !file.isPublic);
    const publicData = 'Hello World';
    const privateData = 'This is private';
    if (!fs.existsSync(FOLDER_PATH)) fs.mkdirSync(FOLDER_PATH);
    fs.writeFileSync(publicFile.localPath, publicData);
    fs.writeFileSync(privateFile.localPath, privateData);

    rdClient = createClient();
    asyncSet = promisify(rdClient.set).bind(rdClient);
    asyncKeys = promisify(rdClient.keys).bind(rdClient);
    asyncDel = promisify(rdClient.del).bind(rdClient);
    rdClient.on('connect', async () => {
      await asyncSet(userOneTokenKey, userOne._id.toString());
      await asyncSet(userTwoTokenKey, userTwo._id.toString());
      resolve();
    });
  }));

  after(async () => {
    fs.rmdirSync(FOLDER_PATH, { recursive: true });
    await db.collection('users').deleteMany({});
    await db.collection('files').deleteMany({});
    await db.dropDatabase();
    await dbClient.close();
    const tokens = await asyncKeys('auth_*');
    const deleteKeysOperations = tokens.map(key => asyncDel(key));
    await Promise.all(deleteKeysOperations);
    rdClient.quit();
  });

  describe('GET /files:id', () => {
    it('should return file details given valid token and user id', () => {
      const file = files[0];
      request(app)
        .get(`/files/${file._id}`)
        .set('X-Token', userOneToken)
        .end((err, res) => {
          const responseAttributes = ['id', 'userId', 'name', 'type', 'isPublic', 'parentId'];
          expect(err).to.be.null;
          expect(res).to.have.status(200);
          expect(res.body).to.include.all.keys(responseAttributes);
          expect(res.body.id).to.equal(file._id.toString());
        });
    });

    it('should reject the request if the token is invalid', () => {
      const file = files[0];
      request(app)
        .get(`/files/${file._id}`)
        .set('X-Token', v4())
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(401);
          expect(res.body.error).to.equal('Unauthorized');
        });
    });

    it('should return not found if file does not exist', () => {
      request(app)
        .get(`/files/${new ObjectId().toString()}`)
        .set('X-Token', userOneToken)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
        });
    });
  });

  describe('GET /files/:id/data', () => {
    it('should fetch data of specified file', done => {
      const file = files.find(file => file.isPublic);
      request(app)
        .get(`/files/${file._id.toString()}/data`)
        .set('X-Token', userOneToken)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(200);
          expect(res.text).to.equal('Hello World');
          done();
        });
    });

    it('should allow cross-user file access as long as the files are public', () => {
      const file = files.find(file => file.isPublic);
      request(app)
        .get(`/files/${file._id.toString()}/data`)
        .set('X-Token', userTwoToken)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(200);
          expect(res.text).to.equal('Hello World');
        });
    });

    it('should allow user to view personal private files', () => {
      const file = files.find(file => !file.isPublic);
      request(app)
        .get(`/files/${file._id.toString()}/data`)
        .set('X-Token', userOneToken)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(200);
          expect(res.text).to.equal('This is private');
        });
    });

    it('should reject request for private files that do not belong to user', done => {
      const file = files.find(file => !file.isPublic);
      request(app)
        .get(`/files/${file._id.toString()}/data`)
        .set('X-Token', userTwoToken)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(404);
          expect(res.body.error).to.equal('Not found');
          done();
        });
    });

    it('should reject request for files that are folders', done => {
      const folder = folders[0];
      request(app)
        .get(`/files/${folder._id}/data`)
        .set('X-Token', userOneToken)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res).to.have.status(400);
          expect(res.body.error).to.equal("A folder doesn't have content");
          done();
        });
    });
  });

  describe('GET /files', () => {
    it('should fetch files without query parameters parentId and page i.e. implicit ParentId=0 and page=0', () => {
      request(app)
        .get('/files')
        .set('X-Token', userOneToken)
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res.body).to.be.an('Array').with.lengthOf(10);
        });
    });
    it('should fetch files when parentId= 0 and page=0 i.e. explicit ParentId=0 and page=0', () => {
      request(app)
        .get('/files')
        .set('X-Token', userOneToken)
        .query({ parentId: '0', page: 0 })
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res.body).to.be.an('Array').with.lengthOf(10);
        });
    });
    it('should fetch files when correct, non-zero parentId is provided', () => {
      request(app)
        .get('/files')
        .set('X-Token', userOneToken)
        .query({ parentId: folders[0]._id.toString(), page: 0 })
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res.body).to.be.an('Array').with.lengthOf(MAX_PAGE_SIZE);
        });
    });
    it('should fetch second page when correct, non-zero parentId is provided', () => {
      request(app)
        .get('/files')
        .set('X-Token', userOneToken)
        .query({ parentId: folders[0]._id.toString(), page: 1 })
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res.body).to.be.an('Array').with.lengthOf(5);
        });
    });

    it('should return an empty list when page is out of index', () => {
      request(app)
        .get('/files')
        .set('X-Token', userOneToken)
        .query({ parentId: folders[0]._id, page: 2 })
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res.body).to.be.an('Array').with.lengthOf(0);
        });
    });

    it('should return an empty list when user has no files', () => {
      request(app)
        .get('/files')
        .set('X-Token', userTwoToken)
        .query({ parentId: '0', page: 0 })
        .end((err, res) => {
          expect(err).to.be.null;
          expect(res.body).to.be.an('Array').with.lengthOf(0);
        });
    });
  });
});
