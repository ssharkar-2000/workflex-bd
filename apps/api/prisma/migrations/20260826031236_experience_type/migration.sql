-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('EXPERIENCED', 'FRESHER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "experienceType" "ExperienceType";
