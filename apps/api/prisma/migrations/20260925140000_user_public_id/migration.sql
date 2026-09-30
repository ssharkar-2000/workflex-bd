-- A readable id for every account: "WF-3A9C1B".
--
-- Added nullable, backfilled from each row's own uuid, then made required —
-- the column cannot be NOT NULL from the start while rows already exist.
ALTER TABLE "users" ADD COLUMN "publicId" TEXT;

UPDATE "users"
SET "publicId" = 'WF-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 6))
WHERE "publicId" IS NULL;

-- Two accounts sharing the first six hex characters of their uuid would break
-- the unique index below. Vanishingly unlikely, but cheap to settle: give any
-- duplicate a longer slice until it is unique.
UPDATE "users" u
SET "publicId" = 'WF-' || UPPER(SUBSTRING(REPLACE(u."id"::text, '-', '') FROM 1 FOR 10))
WHERE EXISTS (
  SELECT 1 FROM "users" o
  WHERE o."publicId" = u."publicId" AND o."id" <> u."id"
);

ALTER TABLE "users" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");
