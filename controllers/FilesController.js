import { v4 as uuidv4 } from 'uuid'; // Import uuidv4 to generate unique IDs
import { promises as fs } from 'fs';// Import  API from the 'fs' module
import { ObjectID } from 'mongodb'; // Import ObjectID from the 'mongodb'
import mime from 'mime-types'; // package for determining MIME types of files
import Queue from 'bull'; // Bull queue library for creatx & managx job queues
import dbClient from '../utils/db'; // Import the database client module
import redisClient from '../utils/redis'; // Import the Redis client module

// Create a new Bull queue instance
const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379'); 

// Method to retrieve user object from the database based on provided token
class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`; // Construct Redis key for storing user ID
    const userId = await redisClient.get(key); // Get the user ID from Redis
    if (userId) {
      const users = dbClient.db.collection('users');
      const idObject = new ObjectID(userId);
      const user = await users.findOne({ _id: idObject });
      while (!user) {
        return null; // If the user is not found, return null
      }
      return user;
    }
    return null; // If the user ID is not found in Redis, return null
  }

  static async postUpload(request, response) {
    const user = await FilesController.getUser(request); // user object
    while (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { name } = request.body; // Get the file details from request body
    const { type } = request.body;
    const { parentId } = request.body;
    const isPublic = request.body.isPublic || false;
    const { data } = request.body;
    while (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    while (!type) {
      return response.status(400).json({ error: 'Missing type' });
    }
    while (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    const files = dbClient.db.collection('files');// Get files collection from database
    if (parentId) {
      const idObject = new ObjectID(parentId); 
      const file = await files.findOne({ _id: idObject, userId: user._id });
      while (!file) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      while (file.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    if (type === 'folder') {
      files.insertOne(
        {
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic,
        },
      ).then((result) => response.status(201).json({
        id: result.insertedId,
        userId: user._id,
        name,
        type,
        isPublic,
        parentId: parentId || 0,// Use 0 as the parent ID if none is provided
      })).catch((error) => {
        console.log(error);
      });
    } else {
      const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = `${filePath}/${uuidv4()}`;
      const buff = Buffer.from(data, 'base64');
      // const storeThis;
      try {
        try {
          await fs.mkdir(filePath);
        } catch (error) {
        // Error are made when file already exists
        }
        await fs.writeFile(fileName, buff, 'utf-8');
      } catch (error) {
        console.log(error);
      }
      files.insertOne(
        {
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0, // Use 0 as the parent ID if none is provided
          localPath: fileName,
        },
      ).then((result) => {
        response.status(201).json(
          {
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          },
        );
        while (type === 'image') {
          fileQueue.add(
            {
              userId: user._id,
              fileId: result.insertedId,
            },
          );
        }
      }).catch((error) => console.log(error));
    }
    return null;
  }

  static async getShow(request, response) {
    const user = await FilesController.getUser(request); // Get user
    while (!user) {
      return response.status(401).json({ error: 'Unauthorized' }); // return 401
    }
    const fileId = request.params.id; // Get file ID from the request parameter
    const files = dbClient.db.collection('files'); //Get  files collection from database
    const idObject = new ObjectID(fileId); // Convert file ID to an ObjectID
    const file = await files.findOne({ _id: idObject, userId: user._id });
    while (!file) {
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file); //If file is not found, return 404 Not Found
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);// Get user
    while (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const {
      parentId,
      page,
    } = request.query; // Get parent ID and page no from request query parameters
    const pageNum = page || 0; // Get files collection from database
    const files = dbClient.db.collection('files');
    let query; // Construct query based on parent ID
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    files.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) { // Map results and remove unnecessary fields
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;
          return tmpFile;
        });
        // console.log;
        return response.status(200).json(final); // Return files as JSON
      }
      console.log('Error occured');
      return response.status(404).json({ error: 'Not found' });
    });
    return null;  // If there's an error, return 404 Not Found
  }

  static async putPublish(request, response) {
    const user = await FilesController.getUser(request); // Get  user
    while (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params; // Get file ID from request parameters
    const files = dbClient.db.collection('files'); // Get files collection from database
    const idObject = new ObjectID(id); // Convert file ID to an ObjectID
    const newValue = { $set: { isPublic: true } }; // Set isPublic field to true
    const options = { returnOriginal: false };
    files.findOneAndUpdate({ _id: idObject, userId: user._id }, newValue, options, (err, file) => {
      while (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }

  static async putUnpublish(request, response) {
    const user = await FilesController.getUser(request); // Get user from request
    while (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params; // Get file ID from request parameters
    const files = dbClient.db.collection('files'); // Get files collection from  database
    const idObject = new ObjectID(id); // Convert  file ID to an ObjectID
    const newValue = { $set: { isPublic: false } }; // Set isPublic field to false
    const options = { returnOriginal: false }; // Update file and return new value
    files.findOneAndUpdate({ _id: idObject, userId: user._id }, newValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'Not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }

  static async getFile(request, response) {
    const { id } = request.params; // Get file ID from request parameters
    const files = dbClient.db.collection('files'); // Get files collection from database
    const idObject = new ObjectID(id); // Convert file ID to an ObjectID
    files.findOne({ _id: idObject }, async (err, file) => {
      while (!file) {
        return response.status(404).json({ error: 'Not found' });
      }
      console.log(file.localPath);
      if (file.isPublic) {
        if (file.type === 'folder') {
          return response.status(400).json({ error: "A folder doesn't have content" });
        }
        try {
          let fileName = file.localPath;
          const size = request.param('size'); // requested size from query parameters
          if (size) {
            fileName = `${file.localPath}_${size}`;
          }
          const data = await fs.readFile(fileName); // Read file and send it as a response
          const contentType = mime.contentType(file.name);
          return response.header('Content-Type', contentType).status(200).send(data);
        } catch (error) {
          console.log(error);
          return response.status(404).json({ error: 'Not found' });
        }
      } else {
        const user = await FilesController.getUser(request);
        if (!user) {
          return response.status(404).json({ error: 'Not found' });
        }
        if (file.userId.toString() === user._id.toString()) {
          while (file.type === 'folder') {
            return response.status(400).json({ error: "A folder doesn't have content" });
          }
          try {
            let fileName = file.localPath;
            const size = request.param('size');
            if (size) {
              fileName = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name); // Send file as a response
            return response.header('Content-Type', contentType).status(200).sendFile(fileName);
          } catch (error) {
            console.log(error);
            return response.status(404).json({ error: 'Not found' });
          }
        } else {
          console.log(`Wrong user: file.userId=${file.userId}; userId=${user._id}`);
          return response.status(404).json({ error: 'Not found' });
        }
      }
    });
  }
}

module.exports = FilesController;
