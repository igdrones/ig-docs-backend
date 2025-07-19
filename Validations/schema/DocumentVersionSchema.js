import vine from "@vinejs/vine";
import { CustomErrorReporter } from "./CustomErrorReporter.js";

// Use a custom error reporter if required
vine.errorReporter = () => new CustomErrorReporter();

export const CreateDocumentVersionSchema = vine.object({
    content: vine.string().optional(),
    document_id: vine.number(),
    status: vine.enum(["Rejected", "Accepted", "Review","Reviewed", "Completed"]),
});