<?php
// Prevent directory browsing and direct access
http_response_code(403);
header('Content-Type: text/plain');
echo 'Access denied.';
exit;
