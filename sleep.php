<?php

ini_set('display_errors', 1);
error_reporting(E_ALL & ~E_DEPRECATED);
date_default_timezone_set('Asia/Tokyo');
mb_internal_encoding('UTF-8');
mb_language('uni');

$n = isset($_REQUEST['n']) ? $_REQUEST['n'] : 1;
$d = date('H:i:s');

sleep($n);
$d2 = date('H:i:s');
?>
OKPHP  <?php echo $d ?> - <?php echo $d2 ?>

<?php var_dump(getallheaders()) ?>
