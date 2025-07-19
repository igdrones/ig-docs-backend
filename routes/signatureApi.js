import {Router} from 'express';

import SignatureControllers, { upload } from '../Controllers/SignatureController.js'
const signatureApi = Router();

signatureApi.get("/validate-doc-url", SignatureControllers.checkValidSignByURL);
signatureApi.post("/validate-doc-pdf",upload.single("document"),SignatureControllers.checkValidSignByFile);
 


export default signatureApi;