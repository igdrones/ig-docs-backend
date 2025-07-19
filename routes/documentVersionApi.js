import {Router} from 'express';

import PermissionsController from "../Controllers/PermissionController.js";
import authorizePermission from '../middleware/AuthorizePermission.js';
import DocumentVersionController , {upload} from '../Controllers/DocumentVersionController.js';
const documentVersionApi = Router();

documentVersionApi.post(
    "/add",
    upload.fields([
      { name: "documents", maxCount: 1 },
      { name: "signatureFile", maxCount: 1 },
    ]),
    DocumentVersionController.createDocumentVersion
  );
  


export default documentVersionApi;