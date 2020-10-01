<?php

//=============================================================================
//   麻雀 シャンテン数計算プログラム
//=============================================================================

// [1] を参考に。ただしそのままでは一盃口の場合にバグがあるので、
// [2] の通り修正した。
// 字牌が順子にならないように修正した。
//
// [3] の向聴数チェックアルゴリズムを移植した。
// 同じ牌種を5枚以上使わないようにした。
//
// [1] http://www5f.biglobe.ne.jp/~kenmo/program/majang/agari/agari.html
// [2] http://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1242853027
// [3] http://kmo2.cocolog-nifty.com/prog/2004/11/post_10.html

//    * 1～9：マンズ
//    * 11～19：ピンズ
//    * 21～29：ソーズ
//    * 31～37：白発中東南西北

//=============================================================================
//   グローバル変数
//=============================================================================

$PAI = array(
	1 => "一",
	2 => "二",
	3 => "三",
	4 => "四",
	5 => "五",
	6 => "六",
	7 => "七",
	8 => "八",
	9 => "九",
	11 => "①",
	12 => "②",
	13 => "③",
	14 => "④",
	15 => "⑤",
	16 => "⑥",
	17 => "⑦",
	18 => "⑧",
	19 => "⑨",
	21 => "１",
	22 => "２",
	23 => "３",
	24 => "４",
	25 => "５",
	26 => "６",
	27 => "７",
	28 => "８",
	29 => "９",
	31 => "東",
	32 => "南",
	33 => "西",
	34 => "北",
	35 => "白",
	36 => "発",
	37 => "中",
);
$PAI_MAX = 38;

$ROUTOU_JIHAI = array(1, 9, 11, 19, 21, 29, 31, 32, 33, 34, 35, 36, 37);



//=============================================================================
//   main
//=============================================================================

if (@$_REQUEST["act"] == "src") {
	$log = file_get_contents("hairi.php");
}
else if (isset($_GET["q"])) {
	//header("Content-Type: text/plain");
	debug(ShantenCheck(HairiTextToArray(trim($_GET["q"]))));
}


//TestAll();
//
//var_dump(ShantenCheck(HairiTextToArray("11345m45p123789s")));	// テンパイ
//var_dump(ShantenCheck(HairiTextToArray("11345m45p12379s1z")));	// １シャンテン
//var_dump(ShantenCheck(HairiTextToArray("11345m45p1237s12z")));	// ２シャンテン
//ShantenCheck(HairiTextToArray("111345m45p1237s1z"));
//ShantenCheck(HairiTextToArray("111345m45p1237s1z"));
//ShantenCheck(HairiTextToArray("111345m45p1237s1z"));
//exit;



//=============================================================================
//   ユーティリティ
//=============================================================================

function debug($str) {
	if (!is_string($str))
		$str = var_export($str, true);
	$GLOBALS['log'] .= $str . "\n";
}

// 天鳳牌理形式の文字列を配列に変換する
//
//$s = "111345m45p12379s7z";
//HairiTextToArray($s)
// => array(14) { [0]=> int(1) [1]=> int(1) [2]=> int(1) [3]=> int(3) [4]=> int(4) [5]=> int(5) [6]=> int(14) [7]=> int(15) [8]=> int(21) [9]=> int(22) [10]=> int(23) [11]=> int(27) [12]=> int(29) [13]=> int(37) }
function HairiTextToArray($s) {
	$s = strtolower($s);	// 小文字に変換
	$a = str_split($s);		// 文字列を文字の配列に変換
	$a = array_reverse($a);	// 配列を逆順に

	$result = array();

	$type = "z";
	foreach ($a as $k => $v) {
		if ($v == "m" || $v == "p" || $v == "s" || $v == "z") {
			$type = $v;
		}
		else {
			if ($type == "m") {
				$result[] = $v + 0;
			}
			elseif ($type == "p") {
				$result[] = $v + 10;
			}
			elseif ($type == "s") {
				$result[] = $v + 20;
			}
			elseif ($type == "z") {
				$result[] = $v + 30;
			}
			else {
				echo "Error: incorrect type\n"; 
			}
		}

	}

	$result = array_reverse($result);
	return $result;
}

// 牌の配列を文字列にする
//
// $s = "111345m45p12379s7z";
// ArrayToString(HairiTextToArray($s));
// => "一一一三四五④⑤１２３７９中"
function ArrayToString($a) {
	$result = "";

	foreach ($a as $v) {
		$result .= $GLOBALS['PAI'][$v];
	}

	return $result;
}




//=============================================================================
//   和了り判定 関連
//=============================================================================

// 手配を種類別枚数に置き換え
function GroupByKind($tehai) {
	$kind = array();
	for ($i = 1; $i < $GLOBALS['PAI_MAX']; $i++) {
		$kind[$i] = 0;
	}

	foreach ($tehai as $k => $v) {
		$kind[$v]++;
	}
	ksort($kind);	// 連想配列をキーでソート

	return $kind;
}

function AgariCheck($tehai) {
	// 少牌チェック。
	// カンしてる場合もあるし、シャンテン数計算に利用するため、多牌はあえて許す
	if (count($tehai) < 14) {
		return false;
	}

	//--------------------------------------------------
	// ①手牌を種類別枚数に置き換え
	$kind = GroupByKind($tehai);

	// 七対子判定
	$isChitoitsu = true;
	foreach ($kind as $k => $v) {
		if ($v != 0 && $v != 2) {
			$isChitoitsu = false;
			break;
		}
	}
	if ($isChitoitsu) {
		return true;
	}

	// 国士無双判定
	// すべての１９字牌を使い、かつ１９字牌の枚数が１４枚になっていれば成立
	$isUseAll19z = true;
	$routouJihaiCount = 0;
	foreach ($GLOBALS['ROUTOU_JIHAI'] as $k => $v) {
		if ($kind[$v] == 0) {
			$isUseAll19z = false;
			break;
		}
		$routouJihaiCount += $kind[$v];
	}
	if ($isUseAll19z && $routouJihaiCount >= 14)
		return true;

	// 通常役 判定
	for ($i = 1; $i < $GLOBALS['PAI_MAX']; $i++) {
		$tmp = $kind;	// 参照のコピーではなく、配列のコピー
		$isAtamaFound = false;

		if ($tmp[$i] >= 2 && !$isAtamaFound) {
			$isAtamaFound = true;
			$tmp[$i] -= 2;
			$mentsuCount = 0;

			for ($j = 1; $j < $GLOBALS['PAI_MAX']; $j++) {
				if ($tmp[$j] >= 3) {	// 刻子があるか？
					$tmp[$j] -= 3;
					$mentsuCount += 1;
				}
				if ($j <= 29 && $tmp[$j] >= 1 && $tmp[$j+1] >= 1 && $tmp[$j+2] >= 1) {	// 順子があるか？
					$tmp[$j] -= 1;
					$tmp[$j+1] -= 1;
					$tmp[$j+2] -= 1;
					$mentsuCount += 1;
					$j--;
				}

				if ($mentsuCount == 4)
					return true;
			}
		}
	}

	return false;
}


function ShantenCheck($tehai) {
	$paiVector = array_keys($GLOBALS['PAI']);

	$ret = array(
		//"ACCEPT_PAI" => $paiVector,
		"SHANTEN" => 100,
	);

	$shantenStr = array(
        "聴牌",
        "一向聴",
        "二向聴",
        "三向聴",
	);

	$result = 100;

	if (AgariCheck($tehai)) {
		debug("あがっている");
		return;
	}

	echo ArrayToString($tehai), "\n";

	for ($i = 0; $i < pow(34, 3); $i++) {
		try {
			$tehai2 = $tehai;
			$kind = GroupByKind($tehai2);

			// 「孤立している牌は計算しない」のため、ダミーとしてセット
			$kind[0] = 0;
			$kind[$GLOBALS['PAI_MAX']] = 0;

			for ($j = $i, $crrShanten = 0; $j > 0; $j = (int)($j / 34), $crrShanten++) {
				$pai = $paiVector[$j % 34];

				if (($kind[$pai-1]
					+ $kind[$pai]
					+ $kind[$pai+1]) == 0) {
					//孤立している牌は計算しない
						throw new Exception("LoopEnd");
				}
				if ($kind[$pai] >= 4)
					throw new Exception("LoopEnd");
				array_push($tehai2, $pai);
			}

			if (AgariCheck($tehai2)) {
				if ($crrShanten <= $result){
					debug(ArrayToString($tehai2));
					debug(($shantenStr[$crrShanten-1]));
					$result = $crrShanten;
				}
			}
		}
		catch (Exception $e) {
			// LoopEnd:
		}
    }

	$ret["SHANTEN"] = $result - 1;

	return $ret;
}



//=============================================================================
//   テスト
//=============================================================================

function TestAll() {
	AgariCheckTest("111345m44p123789s", true);		// 通常形
	AgariCheckTest("34577m222p234555s", true);		// 通常形
	AgariCheckTest("11555m223344p567s", true);		// 通常形
	AgariCheckTest("3355m88p1166s3355z", true);		// 七対子
	AgariCheckTest("119m19p19s1234567z", true);		// 国士無双

	AgariCheckTest("", false);	// 少牌
	AgariCheckTest("111345m45p12379s7z", false);	// 通常形
	AgariCheckTest("123456m123p11s123z", false);	// 通常形 字牌は順子にならない
	AgariCheckTest("334455m88p1166s34z", false);		// 七対子
	AgariCheckTest("333355m88p1166s33z", false);		// 七対子（6種）
	AgariCheckTest("111m19p19s1234567z", false);		// 国士無双
	AgariCheckTest("129m19p19s1234567z", false);		// 国士無双 2枚の牌なし
}

function AgariCheckTest($s, $expected) {
	$result = AgariCheck(HairiTextToArray($s));
	if ($result == $expected) {
		echo "OK : $s   " . ($result ? "あがり" : "あがりでない") . "\n";
	}
	else {
		echo "NG : $s   expected = " . ($expected ? "あがり" : "あがりでない") . "\n";
	}
}

?>
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html lang="ja">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta http-equiv="Content-Style-Type" content="text/css">
  <title>麻雀 シャンテン数計算プログラム</title>
</head>
<body>
	<h1>麻雀 シャンテン数計算プログラム</h1>
	<form name="f1" method="get" action="hairi.php">
		<input type="text" name="q" value="<?php echo isset($_GET["q"]) ? $_GET["q"] : "34m588p1377799s1z1p"; ?>" style="width: 200px">
		<input type="submit" value="OK">
	</form>
		<?php if (isset($log)): ?>
			<pre style="background:#f2f5f7; line-height:12px;"><?php echo nl2br(htmlspecialchars($log)); ?></pre>
		<?php endif; ?>

※手牌に34種の牌を加えて和了り形になるか判定するアルゴリズムを使っているため、遅いです。
そのため、2シャンテンまでしか判定できないように制限を加えてあります。C#版では圧倒的に速い別のアルゴリズムを使っています。

	<p>
		<a href="hairi.php?act=src">このプログラムのソース</a>
	</p>
	
	<h2>既知の問題点（Known issues）</h2>
	<div>
		<ul>
			<li>2シャンテンまでしか判定できない</li>
			<li>1112345678999mの和了り牌として1mを見つけられない</li>
		</ul>
	</div>
	
</body>
</html>
