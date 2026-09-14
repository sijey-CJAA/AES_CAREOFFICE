<?php
require_once __DIR__ . '/config/db.php';

try {
    $pdo->exec("ALTER TABLE `students` ADD COLUMN IF NOT EXISTS `school_year` VARCHAR(50) NOT NULL DEFAULT '' AFTER `section`");
    echo "Column 'school_year' added successfully to students table.";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
