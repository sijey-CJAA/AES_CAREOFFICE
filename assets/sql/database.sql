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
  `student_id` int(11) NULL,
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

-- Junction table for Case Register and Students (many-to-many)
CREATE TABLE IF NOT EXISTS `case_students` (
  `case_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  PRIMARY KEY (`case_id`, `student_id`),
  FOREIGN KEY (`case_id`) REFERENCES `case_register`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ==========================================
-- CARS Module Tables
-- ==========================================

-- CARS Assessment Sessions
CREATE TABLE IF NOT EXISTS `cars_assessment_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `academic_year` varchar(50) DEFAULT NULL,
  `grade_level` varchar(50) DEFAULT NULL,
  `section_name` varchar(100) DEFAULT NULL,
  `evaluator_id` int(11) DEFAULT NULL,
  `assessed_at` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CARS Student Evaluations
CREATE TABLE IF NOT EXISTS `cars_student_evaluations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `q1` tinyint(1) NULL, `q2` tinyint(1) NULL, `q3` tinyint(1) NULL, `q4` tinyint(1) NULL,
  `q5` tinyint(1) NULL, `q6` tinyint(1) NULL, `q7` tinyint(1) NULL, `q8` tinyint(1) NULL,
  `q9` tinyint(1) NULL, `q10` tinyint(1) NULL, `q11` tinyint(1) NULL, `q12` tinyint(1) NULL,
  `q13` tinyint(1) NULL, `q14` tinyint(1) NULL, `q15` tinyint(1) NULL, `q16` tinyint(1) NULL,
  `q17` tinyint(1) NULL, `q18` tinyint(1) NULL, `q19` tinyint(1) NULL, `q20` tinyint(1) NULL,
  `q21` tinyint(1) NULL, `q22` tinyint(1) NULL, `q23` tinyint(1) NULL, `q24` tinyint(1) NULL,
  `externalizing_score` int(11) NULL,
  `internalizing_score` int(11) NULL,
  `social_score` int(11) NULL,
  `academic_score` int(11) NULL,
  `total_raw_score` int(11) NULL,
  `t_score` int(11) NULL,
  `percentile_rank` int(11) NULL,
  `risk_status` enum('NO-RISK', 'AT-RISK', 'HIGH-RISK', 'INCOMPLETE') DEFAULT 'INCOMPLETE',
  `tier_level` enum('Tier 1', 'Tier 2', 'Tier 3', 'Pending') DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`session_id`) REFERENCES `cars_assessment_sessions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CARS Norm Tables Lookups
CREATE TABLE IF NOT EXISTS `cars_norm_tables` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grade_group` varchar(100) NOT NULL,
  `raw_score` int(11) NOT NULL,
  `t_score` int(11) NOT NULL,
  `percentile` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_grade_raw` (`grade_group`, `raw_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
