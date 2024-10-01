// Import required modules and controllers
import { Router } from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

// Create an instance of the Express Router
const router = Router();

// Route to get the status of the application
router.get('/status', AppController.getStatus);

// Route to get application statistics
router.get('/stats', AppController.getStats);

// Route to create a new user
router.post('/users', UsersController.postNew);

// Route to initiate the authentication process
router.get('/connect', AuthController.getConnect);

// Route to disconnect the user
router.get('/disconnect', AuthController.getDisconnect);

// Route to get information about the current user
router.get('/users/me', UsersController.getMe);

// Route to upload a new file
router.post('/files', FilesController.postUpload);

// Route to get details of a specific file
router.get('/files/:id', FilesController.getShow);

// Route to get a list of all files
router.get('/files', FilesController.getIndex);

// Route to publish a specific file
router.put('/files/:id/publish', FilesController.putPublish);

// Route to unpublish a specific file
router.put('/files/:id/unpublish', FilesController.putUnpublish);

// Route to get the data (content) of a specific file
router.get('/files/:id/data', FilesController.getFile);

// Export the router instance
module.exports = router;
