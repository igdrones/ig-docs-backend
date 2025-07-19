
import { validateUploadedPDF } from "../signature/signature.js";
import prisma from "../DB/db.config.js";
import path from "path";
import multer from "multer";

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

class SignatureControllers {

    static async checkValidSignByFile(req, res){
      const file = req.file;
      const doc =  await validateUploadedPDF(file);

        if(doc){
            return res.status(200).json({message: "Valid Signature", data: doc})
        }else{
            return res.status(400).json({message: "Invalid Signature"})
        }
    }

    static async checkValidSignByURL(req, res){
       try {
        const url =  req.body.url;

        const response = await fetch(url);
        console.log(response);
        const arrayBuffer = await response.arrayBuffer();

        const doc =  await validateUploadedPDF(arrayBuffer);

        if(doc){
            return res.status(200).json({message: "Valid Signature"})
        }else{
            return res.status(400).json({message: "Invalid Signature"})
        }
        
       } catch {
        console.log("error");
        return res.status(500).json({message: "Internal Server Error"})
       }

        // TODO: implement the logic to validate the signature using the URL

    }
}

export default SignatureControllers;