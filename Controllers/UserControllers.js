import prisma from "../DB/db.config.js";
import vine, {errors} from '@vinejs/vine';
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { CreateUserSchema, UpdateUserSchema  } from "../Validations/schema/UserSchema.js";
import { messages } from "@vinejs/vine/defaults";

import { s3 } from "../config/awsConfig.js";
import { generateSignatureUrlFromUrl, generateSignedUrlFromUrl } from "../utils/s3Utils.js";

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only accept jpg, jpeg, or png files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
      return cb(null, true);
    }
    cb(new Error("Only jpg, jpeg, or png files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
});

export { upload };


class UserControllers{



    static async store(req,res){
        try {
            const body = req.body;
            const validator = vine.compile(CreateUserSchema);
            const payload = await validator.validate(body);

            //Check if user already exists
            const userExists = await prisma.user.findUnique({
                where: {
                    email: payload.email
                }
            });
            if (userExists) {
                // Check if the user is soft-deleted
                if (userExists.deleted) {
                    // User is soft-deleted
                    return res.status(400).json({ 
                        status: 400, 
                        message: "User is deleted, please activate the user" 
                    });
                } else {
                    // User exists and is active
                    return res.status(400).json({ 
                        status: 400, 
                        message: "User already exists" 
                    });
                }
            }
            
            //Check valid role
            if(payload.role_id){
                const role = await prisma.role.findUnique({
                    where: {
                        id: payload.role_id
                    }
                });
                if(!role){
                    return res.status(404).json({ status: 404, message: "Role not found" });
                }
            } else {
                payload.role_id = 1; //Default role if not provided
            }

            //Encrypt Password
            const salt =   bcrypt.genSaltSync(10);
            payload.password =   bcrypt.hashSync(payload.password, salt);

            const user = await prisma.user.create({
                data: payload
            });
            
            return res.status(201).json({status: 201, message: "User Created Successfully", user});
        } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                console.log(error.messages);
            }else {
                return res.status(500).json({ status: 500, message: "Internal Server Error"});
            }
            return res.status(500).json({ errors: error.messages })
        }
    }

    static async search(req, res) {
        try {
            
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const offset = (page - 1) * limit;
    
            const users = await prisma.user.findMany({
                skip: offset,
                take: limit,
                where: {
                    deleted: false,
                },
                include: {
                    role: true,
                },
            });
    
            const totalUsers = await prisma.user.count({
                where: {
                    deleted: false,
                },
            });

            const totalPages = Math.ceil(totalUsers / limit);
    
            return res.status(200).json({
                status: 200,
                users: users,
                pagination: {
                    totalUsers,
                    totalPages,
                    currentPage: page,
                    limit,
                },
            });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }
    

    static async getAll(req, res) {
        try {
            const { name, id, email, role_id } = req.query;
    
            const filters = {
                deleted: false, // Always exclude deleted users
                ...(name && { name: { contains: name, mode: 'insensitive' } }),  // Optional name filter
                ...(id && { id: Number(id) }),  // Optional id filter
                ...(email && { email: { contains: email, mode: 'insensitive' } }),  // Optional email filter
                ...(role_id && { role_id: Number(role_id) })  // Optional role_id filter
            };
    
            const users = await prisma.user.findMany({
                where: filters,
                include: {
                    role: true, // Include related role data
                },
            });
    
            if (!users.length) {
                return res.status(404).json({ status: 404, message: "No users found" });
            }
    
            return res.status(200).json({ status: 200, data: users });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }
    

    static async getById(req, res) {
        try {
            const userId = parseInt(req.params.id);

            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                include: {
                    role: true,
                }
            });

            if (!user) {
                return res.status(404).json({ status: 404, message: "User not found" });
            }

            return res.status(200).json({ status: 200, data: user });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

    static async update(req, res) {
        try {
            const userId = parseInt(req.params.id);
            const body = req.body;
            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                }
            });
            if (!user) {
                return res.status(404).json({ status: 404, message: "User not found" });
            }
            const validator = vine.compile(UpdateUserSchema);
            const payload = await validator.validate(body);
    
            if (payload.role_id) {
                const role = await prisma.role.findUnique({
                    where: {
                        id: payload.role_id
                    }
                });
                if (!role) {
                    return res.status(404).json({ status: 404, message: "Role not found" });
                }
            }
    
            if (payload.password) {
                const salt = bcrypt.genSaltSync(10);
                payload.password = bcrypt.hashSync(payload.password, salt);
            }
    
            // Filter out null or undefined fields from payload
            const filteredPayload = Object.fromEntries(
                Object.entries(payload).filter(([_, value]) => value != null)
            );
    
            const updatedUser = await prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    ...filteredPayload,
                    updated_at: new Date()
                }
            });
    
            return res.status(200).json({ status: 200, message: "User updated successfully", user: updatedUser });
        } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                console.log(error.messages);
                return res.status(400).json({ errors: error.messages });
            } else {
                console.log(error);
                return res.status(500).json({ status: 500, message: "Internal Server Error" });
            }
        }
    }

    static async delete(req, res) {
        try {
            const { id } = req.params;
    
            const user = await prisma.user.findUnique({
                where: {
                    id: Number(id)
                }
            });

            if (!user) {
                return res.status(404).json({ status: 404, message: "User not found" });
            }

            if (user.email === 'admin@igdrones.com') {
                return res.status(403).json({ status: 403, message: "Admin user cannot be deleted" });
            }

            if (user.deleted) {
                return res.status(400).json({ status: 400, message: "User is already deleted" });
            }

            await prisma.user.update({
                where: {
                    id: Number(id)
                },
                data: {
                    deleted: true,
                    deleted_at: new Date()
                }
            });
    
            return res.status(200).json({ status: 200, message: "User deleted successfully" });
        } catch (error) {
            return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
        }
    }
    

    static async activateUser(req, res) {
        try {
            const { email } = req.body;

            const userExists = await prisma.user.findUnique({
                where: {
                    email: email
                }
            });

            if (!userExists) {
                return res.status(404).json({ 
                    status: 404, 
                    message: "User not found" 
                });
            }

            if (!userExists.deleted) {
                return res.status(400).json({ 
                    status: 400, 
                    message: "User is already active" 
                });
            }

            const updatedUser = await prisma.user.update({
                where: { email: email },
                data: {
                    deleted: false,
                    deleted_at: null
                }
            });

            return res.status(200).json({
                status: 200,
                message: "User reactivated successfully",
                user: updatedUser
            });

        } catch (error) {
            return res.status(500).json({ 
                status: 500, 
                message: "Internal Server Error", 
                error: error.message 
            });
        }
    }

    static async uploadAvatar(req, res) {
        try {
          // Validate if the user is authenticated, and get userId from request
          const userId = req.user.id; // Assuming `req.user.id` contains the authenticated user's ID
    
          if (!req.file) {
            return res
              .status(400)
              .json({ status: 400, message: "No file uploaded" });
          }
    
          const user = await prisma.user.findFirst({
            where: { id: userId },
          });
    
          if (!user) {
            return res.status(404).json({ status: 404, message: "User not found" });
          }
    
          // Generate a unique filename for the image to avoid conflicts
          const fileName = `${uuidv4()}${path
            .extname(req.file.originalname)
            .toLowerCase()}`;
    
          // Upload to S3
          const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME, // Your AWS S3 bucket name
            Key: `avatars/${fileName}`, // File path in S3
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          };
    
          const s3Response = await s3.upload(uploadParams).promise();
    
          // Store the avatar URL in the user's record
          const updatedUser = await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              avatar_url: s3Response.Location,
            },
          });
    
          const url = await generateSignedUrlFromUrl(s3Response.Location);
    
          return res.status(200).json({
            status: 200,
            message: "Avatar updated successfully",
            avatar_url: url,
          });
        } catch (error) {
          console.error("Error uploading avatar:", error);
          return res
            .status(500)
            .json({ status: 500, message: "Internal Server Error" });
        }
      }

      static async uploadSignature(req, res) {
        try {
          // Validate if the user is authenticated, and get userId from request
          const userId = req.user.id; // Assuming `req.user.id` contains the authenticated user's ID
    
          if (!req.file) {
            return res
              .status(400)
              .json({ status: 400, message: "No file uploaded" });
          }
    
          const user = await prisma.user.findFirst({
            where: { id: userId },
          });
    
          if (!user) {
            return res.status(404).json({ status: 404, message: "User not found" });
          }
    
          // Generate a unique filename for the image to avoid conflicts
          const fileName = `${uuidv4()}${path
            .extname(req.file.originalname)
            .toLowerCase()}`;
    
          // Upload to S3
          const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME, // Your AWS S3 bucket name
            Key: `signature/${fileName}`, // File path in S3
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          };
    
          const s3Response = await s3.upload(uploadParams).promise();
    
          // Store the avatar URL in the user's record
          const updatedUser = await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
                signature_url: s3Response.Location,
            },
          });
    
          const url = await generateSignatureUrlFromUrl(s3Response.Location);
    
          return res.status(200).json({
            status: 200,
            message: "Signature updated successfully",
            signature_url: url,
          });
        } catch (error) {
          console.error("Error uploading Signature:", error);
          return res
            .status(500)
            .json({ status: 500, message: "Internal Server Error" });
        }
      }

    static async getMe(req, res) {
        try {
          const userId = req.user.userId; // Assume the user ID is passed in the request (auth middleware should populate this)
    
          // Fetch the user from the database (you can modify the fields as needed)
          const user = await prisma.user.findFirst({
            where: {
              id: userId,
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar_url: true, // Get the avatar URL field
              signature_url: true,
              role: true,
            },
          });
    
          if (!user) {
            return res.status(404).json({ status: 404, message: "User not found" });
          }
    
          // If the user has an avatar_url, generate a signed URL
          if (user.avatar_url) {
            const signedUrl = await generateSignedUrlFromUrl(user.avatar_url);
            user.avatar_url = signedUrl; // Replace the avatar_url with the signed URL
          }

          if (user.signature_url) {
            const signedUrl = await generateSignedUrlFromUrl(user.signature_url);
            user.signature_url = signedUrl;
          }
    
          // Return the user's details along with the signed avatar URL (if available)
          return res.status(200).json({
            status: 200,
            message: "User details fetched successfully",
            user,
          });
        } catch (error) {
          console.error("Error fetching user details:", error);
          return res
            .status(500)
            .json({ status: 500, message: "Internal Server Error" });
        }
      }

}

export default UserControllers;