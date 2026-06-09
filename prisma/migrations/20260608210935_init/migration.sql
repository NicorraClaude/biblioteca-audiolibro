-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "contentLayer" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "licenseStatus" TEXT NOT NULL,
    "categories" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "gutenbergId" INTEGER,
    "copyright" BOOLEAN NOT NULL DEFAULT false,
    "licenseRecord" TEXT,
    "ebookPdfUrl" TEXT,
    "ebookEpubUrl" TEXT,
    "affiliateLinks" TEXT,
    "audioVersions" TEXT,
    "publishedAt" DATETIME,
    "viewsCached" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");
