<?php

// Set the path to the JavaScript file
$js_file_path = './lobby.js';

// Read the content of the JavaScript file
$js_content = file_get_contents($js_file_path);

// Set the headers to serve the content as JavaScript
header('Content-Type: application/javascript; charset=UTF-8');
header('Content-Disposition: inline');

// Output the content of the JavaScript file
echo $js_content;


?>