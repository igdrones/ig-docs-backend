import {Router} from 'express';

import PermissionsController from "../Controllers/PermissionController.js";
import authorizePermission from '../middleware/AuthorizePermission.js';
import DocumentFieldController from '../Controllers/DocumentFieldController.js';
const documentFieldApi = Router();

documentFieldApi.post("/add",DocumentFieldController.create);
documentFieldApi.get('/search', DocumentFieldController.search);
documentFieldApi.get("/:id",DocumentFieldController.getById);
documentFieldApi.put("/:id",DocumentFieldController.update);


export default documentFieldApi;