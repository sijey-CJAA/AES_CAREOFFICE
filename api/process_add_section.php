<?php
require_once '../config/auth.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $grade_level = trim($_POST['grade_level'] ?? '');
    $section_name = trim($_POST['section_name'] ?? '');

    if (empty($grade_level) || empty($section_name)) {
        echo json_encode(['status' => 'error', 'message' => 'Please provide both Grade Level and Section Name.']);
        exit;
    }

    $sections_file = '../config/sections.json';
    if (!file_exists($sections_file)) {
        echo json_encode(['status' => 'error', 'message' => 'Configuration file not found.']);
        exit;
    }

    $grade_sections = json_decode(file_get_contents($sections_file), true);

    if (!isset($grade_sections[$grade_level])) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid Grade Level.']);
        exit;
    }

    // Check if section already exists (case-insensitive)
    foreach ($grade_sections[$grade_level] as $existing_section) {
        if (strcasecmp($existing_section, $section_name) === 0) {
            echo json_encode(['status' => 'error', 'message' => 'Section already exists for this grade level.']);
            exit;
        }
    }

    // Add section
    $grade_sections[$grade_level][] = $section_name;

    // Save back to file
    if (file_put_contents($sections_file, json_encode($grade_sections, JSON_PRETTY_PRINT))) {
        echo json_encode(['status' => 'success', 'message' => 'Section added successfully!', 'sections' => $grade_sections[$grade_level]]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to save the new section.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
