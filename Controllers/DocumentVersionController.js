import prisma from "../DB/db.config.js";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import vine, { errors } from "@vinejs/vine";

import { s3 } from "../config/awsConfig.js";
import { generateSignedUrlFromUrl } from "../utils/s3Utils.js";
import { CreateDocumentVersionSchema } from "../Validations/schema/DocumentVersionSchema.js";
import { signPDF, signPDFSaveDB } from "../signature/signature.js";

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname).toLowerCase();

      if (file.fieldname === "documents" && ext === ".pdf") {
        return cb(null, true); // Allow PDF for "documents"
      }

      if (
        file.fieldname === "signatureFile" &&
        [".png", ".jpg", ".jpeg"].includes(ext)
      ) {
        return cb(null, true); // Allow PNG, JPG, JPEG for "signatureFile"
      }

      // Reject unsupported file types
      cb(
        new Error(
          `Invalid file type for ${file.fieldname}: ${ext}. Expected ${
            file.fieldname === "documents" ? ".pdf" : "PNG, JPG, or JPEG"
          }`
        ),
        false
      );
    } catch (err) {
      console.error("Error in fileFilter:", err);
      cb(err, false); // Handle unexpected errors gracefully
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
});

export { upload };

class DocumentVersionController {
  static async createDocumentVersion(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res
          .status(401)
          .json({ status: 401, message: "Unauthorized: User ID not provided" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      const signatureFile = req.files.signatureFile;
      const documentFile = req.files.documents;

      if (!documentFile || documentFile.length === 0) {
        return res
          .status(400)
          .json({ status: 400, message: "Document file is required" });
      }

      if (!signatureFile || signatureFile.length === 0) {
        return res
          .status(400)
          .json({ status: 400, message: "Signature file is required" });
      }


      const data = JSON.parse(req.body.data);
      const validator = vine.compile(CreateDocumentVersionSchema);
      const payload = await validator.validate(data);
      const { content, document_id, status } = payload;

      // Check if the workflow_type_id exists
      const document = await prisma.documents.findUnique({
        where: { id: parseInt(document_id) },
      });
      if (!document) {
        return res
          .status(400)
          .json({ status: 400, message: "Invalid document ID" });
      }

      if (document.status === "Completed" || document.status === "Rejected") {
        return res.status(400).json({
          status: 400,
          message: "Document is already completed or rejected.",
        });
      }

      if (document.current_stage <= 0) {
        return res.status(400).json({
          status: 400,
          message: "Please set and bind document fields.",
        });
      }

      const stages = document.workflow_stages;
      let currentStage = stages.find(
        (stage) => stage.sequence === document.current_stage
      );
      if (!currentStage) {
        return res
          .status(400)
          .json({ status: 400, message: "No further activity can be done." });
      }

   
      if (currentStage.action_by_id != userId) {
        return res.status(403).json({
          status: 403,
          message: "Unauthorized: User does not have the required role.",
        });
      }

      // Generate a unique filename
      const fileName = `documents/${document.id}/${
        document.current_stage
      }/${uuidv4()}${documentFile[0].originalname}`;

      let uploadParams = {};

      if (status === "Accepted") {
        const doc = await signPDFSaveDB(document, signatureFile, user);

        // Upload the document to S3
        uploadParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileName,
          Body: documentFile[0].buffer,
          ContentType: documentFile[0].mimetype,
        };
      } else if (status === "Completed") {
        const doc = await signPDF(documentFile, document, signatureFile, user);

        // Upload the document to S3
        uploadParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileName,
          Body: doc,
          ContentType: documentFile[0].mimetype,
        };
      }
      console.log(uploadParams);
      const s3Response = await s3.upload(uploadParams).promise();
      const file_url = s3Response.Location;
      // Optionally, generate a signed URL if needed
      const signedUrl = await generateSignedUrlFromUrl(s3Response.Location);

      switch (status) {
        case "Rejected": {
          if (document.current_version <= 1)
            return res
              .status(400)
              .json({ status: 400, message: "Invalid Operation" });
          // Reject the document version
          const updatedDocument = await prisma.documents.update({
            where: { id: parseInt(document_id) },
            data: { status: status },
          });

          const documentVersion = await prisma.document_versions.create({
            data: {
              content,
              document_id,
              file_url,
              version: document.current_version,
              created_by_id: userId,
            },
          });

          documentVersion.file_url = signedUrl;

          return res.status(200).json({
            status: 200,
            message: "Document rejected",
            document: updatedDocument,
            document_version: documentVersion,
          });
        }

        case "Review": {
          if (document.current_version <= 1)
            return res
              .status(400)
              .json({ status: 400, message: "Invalid Operation" });
          const updatedDocument = await prisma.documents.update({
            where: { id: parseInt(document_id) },
            data: {
              status: status,
              current_version: document.current_version + 1,
              current_stage: currentStage.sequence - 1,
            },
          });

          const documentVersion = await prisma.document_versions.create({
            data: {
              content,
              document_id,
              file_url,
              version: document.current_version,
              created_by_id: userId,
            },
          });

          documentVersion.file_url = signedUrl;

          return res.status(200).json({
            status: 200,
            message: "Document in review",
            document: updatedDocument,
            document_version: documentVersion,
          });
        }
        case "Reviewed": {
          const updatedDocument = await prisma.documents.update({
            where: { id: parseInt(document_id) },
            data: {
              status: "InTransition",
              current_version: document.current_version + 1,
              current_stage: currentStage.sequence + 1,
            },
          });

          const documentVersion = await prisma.document_versions.create({
            data: {
              content,
              document_id,
              file_url,
              version: document.current_version,
              created_by_id: userId,
            },
          });

          documentVersion.file_url = signedUrl;

          return res.status(200).json({
            status: 200,
            message: "Document in transition",
            document: updatedDocument,
            document_version: documentVersion,
          });
        }

        case "Accepted": {
          const updatedDocument = await prisma.documents.update({
            where: { id: parseInt(document_id) },
            data: {
              status: "InTransition",
              current_version: document.current_version + 1,
              current_stage: currentStage.sequence + 1,
            },
          });

          const documentVersion = await prisma.document_versions.create({
            data: {
              content,
              document_id,
              file_url,
              version: document.current_version,
              created_by_id: userId,
            },
          });

          documentVersion.file_url = signedUrl;

          return res.status(200).json({
            status: 200,
            message: "Document in transition",
            document: updatedDocument,
            document_version: documentVersion,
          });
        }

        case "Completed": {
          const updatedDocument = await prisma.documents.update({
            where: { id: parseInt(document_id) },
            data: {
              status: status,
              current_version: document.current_version + 1,
              current_stage: currentStage.sequence + 1,
            },
          });

          const documentVersion = await prisma.document_versions.create({
            data: {
              content,
              document_id,
              file_url,
              version: document.current_version,
              created_by_id: userId,
            },
          });

          documentVersion.file_url = signedUrl;

          return res.status(200).json({
            status: 200,
            message: "Document Completed",
            document: updatedDocument,
            document_version: documentVersion,
          });
        }
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      return res
        .status(500)
        .json({ status: 500, message: "Internal Server Error" });
    }
  }
}

export default DocumentVersionController;
