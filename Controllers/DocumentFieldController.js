import vine, { errors } from '@vinejs/vine';
import { CreateDocumentFieldSchema, UpdateDocumentFieldSchema } from "../Validations/schema/DocumentFieldSchema.js";
import prisma from "../DB/db.config.js";
import { messages } from '@vinejs/vine/defaults';

class DocumentFieldController {
  static async create(req, res) {
    try {
        const validator = vine.compile(CreateDocumentFieldSchema);
        const payload = await validator.validate(req.body);


        const documentExists = await prisma.documents.findUnique({
          where: { id: payload.document_id },
        });

        if (!documentExists) {
          return res.status(404).json({
            status: 404,
            message: "Document not found",
          });
        }

        let validTextAndSign = true;

       payload?.doc_data.forEach((docFiled) =>{
        const validText = docFiled?.field_type === "Text" ? docFiled?.font_size > 0 : true ;
        const validSignature = docFiled?.field_type === "Signature" ? docFiled?.height > 0 && docFiled?.width > 0 : true;
        validTextAndSign = validTextAndSign && validText && validSignature;
       });

       if(!validTextAndSign){
        return res.status(400).json({
            status: 400,
            messages: "Please Add Valid Text and Signature Field."
        })
    
    }

        const documentFields = await prisma.document_fields.create({
              data: payload
            })

        return res.status(201).json({
          status: 201,
          message: "Document fields created successfully",
          data: documentFields,
        });
    } catch (error) {

      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(400).json({
          status: 400,
          message: "Validation Error",
          errors: error.messages,
        });
      }

      console.error("Error creating document fields:", error);
      return res.status(500).json({
        status: 500,
        message: "Internal Server Error",
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;

      const documentField = await prisma.document_fields.findUnique({
        where: { id: parseInt(id) },
        
      });

      if (!documentField || documentField.deleted) {
        return res.status(404).json({
          status: 404,
          message: "Document Field not found",
        });
      }

      return res.status(200).json({
        status: 200,
        message: "Document Field fetched Successfully",
        documentField,
      });
    } catch (error) {
      console.error("Error fetching Document Field by ID:", error);
      return res
        .status(500)
        .json({ status: 500, message: "Internal Server Error" });
    }
  }

  static async search(req, res) {
    try {
      const { document_id, stages} = req.query;

      const filters = {};
      if (document_id) {
        filters.document_id = parseInt(document_id);
      }
      console.log(filters);

      const documentFields = await prisma.document_fields.findMany({
        where: {
          ...filters,
          deleted: false,
        },
        orderBy: {
          created_at: 'desc', 
        },
      });

      const filterDocumentField = documentFields.map((docFiled) => {
        const doc_data = docFiled.doc_data.map((docFiled) => {if(docFiled.stages === parseInt(stages)) return docFiled});
         docFiled.doc_data = doc_data;

         return docFiled;
      })

      return res.status(200).json({
        status: 200,
        message: 'Document Field fetched successfully',
        documentFields: filterDocumentField,
        
      });
    } catch (error) {
      console.error('Error searching document fields:', error);
      return res.status(500).json({ status: 500, message: 'Internal Server Error' });
    }
  }

  static async update(req, res) {
    try {
        const { id } = req.params;
        const validator = vine.compile(UpdateDocumentFieldSchema);
        const payload = await validator.validate(req.body);

        const existingDocumentField = await prisma.document_fields.findUnique({
            where: { id: parseInt(id) },
        });
        if (!existingDocumentField || existingDocumentField.deleted) {
            return res.status(404).json({ status: 404, message: "Document not found" });
        }

        const updatedDocumentField = await prisma.document_fields.update({
            where: { id: parseInt(id) },
            data: payload,
        });

        return res.status(200).json({
            status: 200,
            message: "Document Updated Successfully",
            documentField: updatedDocumentField
        });
    } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
            return res.status(400).json({ status: 400, message: "Validation Error", errors: error.messages });
        }
        console.error("Error updating Workflow:", error);
        return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
}

}

export default DocumentFieldController;
