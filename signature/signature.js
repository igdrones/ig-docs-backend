import { SIGN_MARKER_END, SIGN_MARKER_START } from "../lib/constant.js";
import prisma from "../DB/db.config.js";

const createSignatureData = async (documentName, signatureImage, user) => {
  const buffer = await signatureImage[0].buffer;
  const base64Photo = buffer.toString('base64');
  return {
    fileName: `${documentName}.pdf`,
    dateTime: new Date().toISOString(),
    subject: "Signed by IG Docs",
    issuer: "IG Drones India pvt. Ltd.",
    signerInfo: {
      name: `${user.name}`,
      timestamp: Date.now(),
      signatureImage: base64Photo,
    }
  };
};

export const signPDFSaveDB = async ( document, signatureImage, user) => {
  if ( !signatureImage || !user) return;

  try {
    // Extract existing signatures
    const existingSignature = await prisma.documentSiganatures.findUnique({
      where: { document_id: document.id },
    });
   if (existingSignature){
    const existingSignatures = existingSignature?.signature_data || [];
    
    // Create new signature data
    const newSignature = await createSignatureData(document.name, signatureImage, user);
    

    
    // Prepare combined signature data
    const signatures = Array.isArray(existingSignatures) ? [...existingSignatures, newSignature] : [newSignature];

    existingSignature.signature_data = signatures;
    await prisma.documentSiganatures.update({
      where: { id: existingSignature.id },
      data: { signature_data: signatures },
    });
   }else{
    // Create new signature data
    const newSignature = await createSignatureData(document.name, signatureImage, user);
    
    // Prepare combined signature data
    const signatures = [newSignature];
    
    await prisma.documentSiganatures.create({
      data: {
        document_id: document.id,
        signature_data: signatures,
      },
    });
   }
    
    

  } catch (error) {
    console.error('Error signing PDF:', error);
    throw error;
  }
};


const extractSignature = async (file) => {
  try {
    const buffer = await file[0].buffer;
    const content = buffer.toString();

    const startIndex = content.indexOf(SIGN_MARKER_START);
    const endIndex = content.indexOf(SIGN_MARKER_END);
    
    if (startIndex === -1 || endIndex === -1) {
      return []; // Return empty array if no signature found
    }

    const signatureJson = content.substring(
      startIndex + SIGN_MARKER_START.length,
      endIndex
    );

    return JSON.parse(signatureJson);
  } catch (error) {
    console.error('Error extracting signature:', error);
    return [];
  }
};

const separatePdfAndSignature = (buffer) => {
  const content = buffer.toString();
  const startIndex = content.indexOf(SIGN_MARKER_START);
  
  if (startIndex === -1) {
    return {
      pdfContent: buffer,
      hasSignature: false
    };
  }
  
  return {
    pdfContent: buffer.slice(0, startIndex),
    hasSignature: true
  };
};

export const signPDF = async (file, document, signatureImage, user) => {
  if (!file || !signatureImage || !user) return;

  try {
    // Extract existing signatures
    const existingSignature = await prisma.documentSiganatures.findUnique({
      where: { document_id: document.id }
    });

    const existingSignatures = existingSignature.signature_data;
    
    // Create new signature data
    const newSignature = await createSignatureData(document.name, signatureImage, user);
    
    // Get original PDF content
    const { pdfContent } = separatePdfAndSignature(file[0].buffer);
    
    // Prepare combined signature data
    const signatures = Array.isArray(existingSignatures) ? [...existingSignatures, newSignature] : [newSignature];
    
    // Add new signature after PDF content
    const signatureString = `${SIGN_MARKER_START}${JSON.stringify(signatures)}${SIGN_MARKER_END}`;
    
    // Combine original PDF content with signature
    const combinedBuffer = Buffer.concat([
      pdfContent,
      Buffer.from(signatureString)
    ]);
    
    return combinedBuffer;
  } catch (error) {
    console.error('Error signing PDF:', error);
    throw error;
  }
};

export const validateUploadedPDF = async (file) => {
  try {
    const buffer = await file.buffer;
    const content = buffer.toString();

    const startIndex = content.indexOf(SIGN_MARKER_START);
    const endIndex = content.indexOf(SIGN_MARKER_END);
    
    if (startIndex === -1 || endIndex === -1) {
      return null;
    }

    const signatureJson = content.substring(
      startIndex + SIGN_MARKER_START.length,
      endIndex
    );

    return JSON.parse(signatureJson);
  } catch (error) {
    console.error('Validation error:', error);
    return null;
  }
};