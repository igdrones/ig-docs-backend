/*
  Warnings:

  - A unique constraint covering the columns `[document_id]` on the table `Document_fields` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "DocumentSiganatures" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "signature_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSiganatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSiganatures_document_id_key" ON "DocumentSiganatures"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fields_document_id_key" ON "Document_fields"("document_id");
