<?php
// Set your return content type
#header('Content-type: application/xml');
ini_set('user_agent', 'Sonet-lab');

//allowed hosts
$allowed = array("wikipedia.org", "toolserver.org", "wikimedia.org");

if (!isset($_GET["url"]))
    die();

// Website url to open
$daurl = $_GET["url"];

$tmp = explode(".", parse_url($daurl, PHP_URL_HOST));

if (!in_array($tmp[count($tmp)-2].".".$tmp[count($tmp)-1], $allowed))
    die();

// Get that website's content
$content = file_get_contents($daurl);

// serve it!
if (!(strpos($http_response_header[0], "200"))) {
    if (strpos($http_response_header[0], "404")) {
        echo "No results found!";
    }
    else {
        echo "Error: ".$http_response_header[0];
    }
}
else {
    echo $content;
}
?>
