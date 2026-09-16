-- Run this script in phpMyAdmin to create the tables in your `aes` database.
-- First, ensure the `aes` database exists. If not, create it.
-- CREATE DATABASE IF NOT EXISTS aes;
-- USE aes;

-- Table for the waitlist/data entry (legacy)
CREATE TABLE IF NOT EXISTS `waitlist` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  `full_name` varchar(255) NOT NULL,
  `lrn` varchar(50) NOT NULL,
  `grade_section` varchar(100) NOT NULL,
  `grade_level` varchar(20) NOT NULL DEFAULT '',
  `section` varchar(100) NOT NULL DEFAULT '',
  `school_year` varchar(50) NOT NULL DEFAULT '',
  `date_of_birth` date NOT NULL,
  `home_address` text NOT NULL,
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
  `full_name` varchar(255) NOT NULL,
  `relationship` varchar(100) NOT NULL,
  `home_address` text NOT NULL,
  `mobile_number` varchar(50) NOT NULL,
  `telephone_number` varchar(50) DEFAULT NULL,
  `email_address` varchar(255) DEFAULT NULL,
  `workplace` varchar(255) DEFAULT NULL,
  `workplace_address` text DEFAULT NULL,
  `emergency_contact_number` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for Guidance Office Assessment Records
CREATE TABLE IF NOT EXISTS `assessment_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` int(11) NOT NULL,
  `record_number` varchar(50) NOT NULL UNIQUE,
  `school_year` varchar(20) NOT NULL,
  `date` date NOT NULL,
  `grade_section` varchar(50) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `status` varchar(50) NOT NULL,
  `assessment_provider` varchar(100) NOT NULL,
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
  `case_number` varchar(50) NOT NULL UNIQUE,
  `school_year` varchar(20) NOT NULL,
  `date` date NOT NULL,
  `grade_section` varchar(50) NOT NULL,
  `case_type` varchar(100) NOT NULL,
  `brief_description` text,
  `actions_taken` text,
  `outcome_disposition` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
