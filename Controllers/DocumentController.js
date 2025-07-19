import prisma from "../DB/db.config.js";
import path from "path";
import { CreateDocumentSchema } from "../Validations/schema/DocumentSchema.js";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { s3 } from "../config/awsConfig.js";
import { generateSignedUrlFromUrl } from "../utils/s3Utils.js";
import vine from "@vinejs/vine";

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    try {
      // Log file details for debugging
      console.log("File Details:", file);

      // Only accept PDF files
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === ".pdf") {
        return cb(null, true);
      }
      // Reject other file types
      return cb(new Error("Only PDF files are allowed"), false);
    } catch (err) {
      console.error("Error in fileFilter:", err);
      cb(err, false); // Handle unexpected errors gracefully
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
});

export { upload };

class DocumentController {
  static async createDocument(req, res) {
    try {
      const userId = req.user?.userId; // Ensure `userId` is available from `req.user`
      if (!userId) {
        return res
          .status(401)
          .json({ status: 401, message: "Unauthorized: User ID not provided" });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({ status: 400, message: "No file uploaded" });
      }

      console.log(req.body.data);
      const payload = JSON.parse(req.body.data);
      const { name, workflow_type_id, workflow_id } =payload;
      console.log(workflow_type_id, workflow_id);

      // Check if the workflow_type_id exists
      const workflowType = await prisma.workflow_type.findFirst({
        where: { id: parseInt(workflow_type_id) },
      });
      if (!workflowType) {
        return res
          .status(400)
          .json({ status: 400, message: "Invalid workflow type ID" });
      }

      // Check if the workflow_id exists
      const workflow = await prisma.workflow.findFirst({
        where: { id: parseInt(workflow_id) },
        include: { Stages: true },
      });
      if (!workflow) {
        return res
          .status(400)
          .json({ status: 400, message: "Invalid workflow ID" });
      }

        // Sort stages by sequence
      const stages = workflow.Stages;
      const stagesMap = new Map(stages.map(stage => [stage.id, { ...stage, sequence: null }]));

      // Identify the starting stage
      let currentStage = stages.find(stage => stage.node_stage === "Start");
      if (!currentStage) {
        return res.status(400).json({ status: 400, message: "No starting stage found in the workflow" });
      }

      // Assign sequence numbers
      let sequence = 1;
      while (currentStage) {
        stagesMap.get(currentStage.id).sequence = sequence;
        sequence++;
        currentStage = stagesMap.get(currentStage.next_stage_id);
      }

      // Convert stages back to an array
      const sequencedStages = Array.from(stagesMap.values())
      .sort((a, b) => a.sequence - b.sequence)
      .map(stage => ({
        id: stage.id,
        name: stage.name,
        status: stage.status,
        role_id: stage.role_id,
        sequence: stage.sequence,
        node_stage: stage.node_stage,
        stage_type: stage.stage_type,
        description: stage.description,
        workflow_id: stage.workflow_id,
        action_by_id: stage.action_by_id,
        next_stage_id: stage.next_stage_id,
      }));

      const lastStage = sequencedStages[sequencedStages.length - 1];
      if (!lastStage || lastStage.node_stage !== "End") {
        return res.status(400).json({
          status: 400,
          message: "Invalid workflow: The last stage must have node_stage set to 'End'",
        });
      }
  

      // Generate a unique filename
      const fileName = `documents/${uuidv4()}${path
        .extname(req.file.originalname)
        .toLowerCase()}`;

      // Upload the document to S3
      const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };
      const s3Response = await s3.upload(uploadParams).promise();

      // Prepare document data for the database
      const docData = {
        name,
        current_version: 0,
        workflow_stages: sequencedStages,
        workflow_type_id,
        workflowId: workflow_id,
        filename: fileName,
        file_url: s3Response.Location,
        file_size: req.file.size,
        file_type: req.file.mimetype,
        current_stage: 0,
        created_by_id: userId,
      };

      // Create the document in the database
      const newDoc = await prisma.documents.create({ data: docData });


      // Optionally, generate a signed URL if needed
      const signedUrl = await generateSignedUrlFromUrl(s3Response.Location);

      return res.status(201).json({
        status: 201,
        message: "Document uploaded successfully",
        data: newDoc,
        docUrl: signedUrl,
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      return res
        .status(500)
        .json({ status: 500, message: "Internal Server Error" });
    }
  }

  static async search(req, res) {
    try {
      const { workflow_type_id, workflow_id, page = 1, limit = 10 } = req.query;

      const filters = {};
      if (workflow_type_id) {
        filters.workflow_type_id = parseInt(workflow_type_id);
      }
      if (workflow_id) {
        filters.workflowId = parseInt(workflow_id);
      }

      const skip = (page - 1) * limit;
      const take = parseInt(limit);

      const documents = await prisma.documents.findMany({
        where: {
          ...filters,
          deleted: false,
        },
        include: {
          workflow_type: true,
          Workflow: true,    
          created_by: true, 
        },
        skip,
        take,
        orderBy: {
          created_at: 'desc', 
        },
      });

      const totalDocuments = await prisma.documents.count({ where: { ...filters, deleted: false } });

      return res.status(200).json({
        status: 200,
        message: 'Documents fetched successfully',
        documents: documents,
        pagination: {
          total: totalDocuments,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalDocuments / limit),
        },
      });
    } catch (error) {
      console.error('Error searching documents:', error);
      return res.status(500).json({ status: 500, message: 'Internal Server Error' });
    }
  }

  static async getDocumentById(req, res) {
    try {
      const { id } = req.params; // Extract the ID from the route parameters
  
      if (!id) {
        return res.status(400).json({
          status: 400,
          message: "Document ID is required",
        });
      }
  
      const document = await prisma.documents.findUnique({
        where: {
          id: parseInt(id),
          deleted: false, // Ensure the document is not marked as deleted
        },
        include: {
          Document_fields: true,
          Document_versions:{
            orderBy: {
              version: 'desc', 
            },
          },
          workflow_type: true,
          Workflow: true,
          created_by: true,
        },
      });
  
      if (!document) {
        return res.status(404).json({
          status: 404,
          message: "Document not found",
        });
      }

      if(document.current_version >0){
        document.file_url = document.Document_versions[0].file_url;
      }
      

      const signedUrl = await generateSignedUrlFromUrl(document.file_url);
      document.file_url = signedUrl; // Add the signed URL to the document object
  
      return res.status(200).json({
        status: 200,
        message: "Document fetched successfully",
        document,
      });
    } catch (error) {
      console.error("Error fetching document by ID:", error);
      return res.status(500).json({
        status: 500,
        message: "Internal Server Error",
      });
    }
  }


  static async updateDocumentStage(req, res){
    try {
      const{id} = req.params;
      
      const { stage_id, action_by_id } = req.body;
      const document = await prisma.documents.findUnique({
        where: { id: parseInt(id) }
      });

      if (!document) {
        return res.status(404).json({
          status: 404,
          message: "Document not found",
        });
      }
      const user = await prisma.user.findUnique({
        where: { id: parseInt(action_by_id) },
        include: { role: true },
      });
      
      if (!user) {
        return res.status(404).json({
          status: 404,
          message: "User not found",
        });
      }

      let isStageUpdateable = false;

      const stages = document.workflow_stages;

      const updatedStages = stages.map((st)=> {
        if(st.id === parseInt(stage_id)){
          st.action_by_id = parseInt(action_by_id);

          if(user.role.id === st.role_id) isStageUpdateable = true;
        }
        return st;
      });
      
      // Check if the user has permission to update the stage
      if(isStageUpdateable){
        const updatedDocument = await prisma.documents.update({
          where: { id: parseInt(id) },
          data: { workflow_stages: updatedStages },
          include: {
            workflow_type: true,
            Workflow: true,
            created_by: true,
          },
        });
  
        const signedUrl = await generateSignedUrlFromUrl(document.file_url);
        updatedDocument.file_url = signedUrl; // Add the signed URL to the document object
        return res.status(200).json({
          status: 200,
          message: "Document stage updated successfully",
          document: updatedDocument,
        });
      }else{
        return res.status(403).json({
          status: 403,
          message: "User can not be added stage",
        });
      }

    } catch (e) {
      console.error("Error updating document stage:", e);
      return res.status(500).json({
        status: 500,
        message: "Internal Server Error",
      });
    }
  }

  static async submitDocument(req, res) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
  
      const document = await prisma.documents.findUnique({
        where: {
          id: parseInt(id),
          deleted: false, // Ensure the document is not marked as deleted
        },
        include: {
          Document_fields: true,
        },
      });
  
      if (!document) {
        return res.status(404).json({
          status: 404,
          message: "Document not found",
        });
      }

      if(document.Document_fields.length>0){
        const updatedDocument = await prisma.documents.update({
          where: { id: parseInt(id) },
          data: {
            current_stage: 1,
            current_version: 1,
            status: 'InTransition'
          },
        })

        const addVersion = await prisma.document_versions.create({
          data: {
              document_id: document.id,
              content: "Document Submitted",
              version: updatedDocument.current_version,
              file_url: updatedDocument.file_url,
              created_by_id: userId,
          }
        })

        return res.status(200).json({
          status: 200,
          message: "Document submitted successfully",
        });
      }

      return res.status(400).json({
        status: 400,
        message: "No document fields found",
      });

      
    }catch(e){
      console.error("Error submitting document:", e);
      return res
       .status(500)
       .json({ status: 500, message: "Internal Server Error" });
    }
  }

  static async getDocumentStageAction(req, res) {
    try {
      const userId = req.user.userId;
      const roleId = req.user.role.id;
  
      // Extract query parameters
      const { page = 1, limit = 10, search = '' } = req.query;
  
      // Calculate offset for pagination
      const offset = (page - 1) * limit;
  
      // Query documents with filtering, pagination, and search by name
      const documents = await prisma.documents.findMany({
        where: {
          workflow_stages: {
            array_contains: [
              {
                role_id: roleId,
                action_by_id: userId,
              },
            ],
          },
          name: {
            contains: search, // Search by document name
            mode: 'insensitive', // Case-insensitive search
          },
        },
        include: {
          workflow_type: true,
          Workflow: true,
          Document_fields: true,
          created_by: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: parseInt(limit),
      });
  
      // Get total count for pagination metadata
      const totalDocuments = await prisma.documents.count({
        where: {
          workflow_stages: {
            array_contains: [
              {
                role_id: roleId,
                action_by_id: userId,
              },
            ],
          },
          name: {
            contains: search, // Match total count condition with search
            mode: 'insensitive',
          },
        },
      });
  
      // Response with pagination metadata
      return res.status(200).json({
        status: 200,
        message: 'Documents fetched successfully',
        documents,
        pagination: {
          total: totalDocuments,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalDocuments / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({
        status: 500,
        message: 'An error occurred while fetching documents',
      });
    }
  }


  static async getMyDocumentRequests(req, res){
    try {
      const userId = req.user.userId;
      const roleId = req.user.role.id;
  
      // Extract query parameters
      const { page = 1, limit = 10, search = '' } = req.query;
  
      // Calculate offset for pagination
      const offset = (page - 1) * limit;
  
      // Query documents with filtering, pagination, and search by name
      const documents = await prisma.documents.findMany({
        where: {
          workflow_stages: {
            array_contains: [
              {
                role_id: roleId,
                action_by_id: userId,
              },
            ],
          },
          name: {
            contains: search, // Search by document name
            mode: 'insensitive', // Case-insensitive search
          },
        },
        include: {
          workflow_type: true,
          Workflow: true,
          Document_fields: true,
          created_by: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: parseInt(limit),
      });
  
      // Get total count for pagination metadata
      const totalDocuments = await prisma.documents.count({
        where: {
          workflow_stages: {
            array_contains: [
              {
                role_id: roleId,
                action_by_id: userId,
              },
            ],
          },
          name: {
            contains: search, // Match total count condition with search
            mode: 'insensitive',
          },
        },
      });

      let docRequrst =  [];
      documents.forEach(document => {
        document.workflow_stages.forEach(stage => {
          if((stage.sequence === document.current_stage) && stage.action_by_id === userId){
            docRequrst.push(document);
          }
        })
      })

     
  
      // Response with pagination metadata
      return res.status(200).json({
        status: 200,
        message: 'Documents fetched successfully',
        documents: docRequrst,
        pagination: {
          total: totalDocuments,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalDocuments / limit),
        },
      });
    }catch (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({
        status: 500,
        message: 'An error occurred while fetching documents',
      });
    }
  }
  
  
  
  
  
}

export default DocumentController;
