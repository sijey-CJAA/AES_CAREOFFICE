-- Run this script in phpMyAdmin to create the tables in your `aes` database.
-- First, ensure the `aes` database exists. If not, create it.
-- CREATE DATABASE IF NOT EXISTS aes;
-- USE aes;

-- Table for admin users
CREATE TABLE IF NOT EXISTS `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for Students (Learner Information)
CREATE TABLE IF NOT EXISTS `students` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(255) DEFAULT NULL,
  `lrn` varchar(50) DEFAULT NULL,
  `grade_section` varchar(100) DEFAULT NULL,
  `grade_level` varchar(20) DEFAULT NULL,
  `section` varchar(100) DEFAULT NULL,
  `school_year` varchar(50) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `home_address` text DEFAULT NULL,
  `blood_type` varchar(10) DEFAULT NULL,
  `allergies` text DEFAULT NULL,
  `medications` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Unknown / Not Indicated',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for Parents/Guardians
CREATE TABLE IF NOT EXISTS `parents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `parent_type` enum('Primary', 'Secondary') NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `relationship` varchar(100) DEFAULT NULL,
  `home_address` text DEFAULT NULL,
  `mobile_number` varchar(50) DEFAULT NULL,
  `telephone_number` varchar(50) DEFAULT NULL,
  `email_address` varchar(255) DEFAULT NULL,
  `workplace` varchar(255) DEFAULT NULL,
  `workplace_address` text DEFAULT NULL,
  `emergency_contact_number` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for Guidance Office Assessment Records
CREATE TABLE IF NOT EXISTS `assessment_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `record_number` varchar(50) DEFAULT NULL UNIQUE,
  `school_year` varchar(20) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `grade_section` varchar(50) DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `assessment_provider` varchar(100) DEFAULT NULL,
  `findings` text,
  `recommendations` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for Guidance Office Case Register
CREATE TABLE IF NOT EXISTS `case_register` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `case_number` varchar(50) DEFAULT NULL UNIQUE,
  `school_year` varchar(20) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `grade_section` varchar(50) DEFAULT NULL,
  `case_type` varchar(100) DEFAULT NULL,
  `brief_description` text,
  `actions_taken` text,
  `outcome_disposition` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

