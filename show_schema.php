<?php
require_once __DIR__ . '/config/db.php';
$stmt = $pdo->query("SHOW CREATE TABLE students");
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo $row['Create Table'];
