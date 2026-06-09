-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
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
    "textDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "textPath" TEXT,
    "librivoxUrl" TEXT,
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
INSERT INTO "new_Book" ("affiliateLinks", "audioVersions", "author", "categories", "contentLayer", "contentType", "copyright", "coverImageUrl", "createdAt", "description", "downloadCount", "ebookEpubUrl", "ebookPdfUrl", "gutenbergId", "id", "language", "licenseRecord", "licenseStatus", "publishedAt", "slug", "sourceName", "sourceUrl", "status", "title", "updatedAt", "viewsCached") SELECT "affiliateLinks", "audioVersions", "author", "categories", "contentLayer", "contentType", "copyright", "coverImageUrl", "createdAt", "description", "downloadCount", "ebookEpubUrl", "ebookPdfUrl", "gutenbergId", "id", "language", "licenseRecord", "licenseStatus", "publishedAt", "slug", "sourceName", "sourceUrl", "status", "title", "updatedAt", "viewsCached" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_slug_key" ON "Book"("slug");
CREATE UNIQUE INDEX "Book_gutenbergId_key" ON "Book"("gutenbergId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
