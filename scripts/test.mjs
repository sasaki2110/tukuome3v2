// Node.js環境でfetch APIを使用する場合、node-fetchのようなライブラリが必要になることがあります。
// ブラウザ環境ではfetchはデフォルトで利用可能です。

async function callGemmaAPI(prompt) {
    const response = await fetch('http://nvicuda:8000/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt }),
    });

    if (response.ok) {
        const data = await response.json();
        console.log("Gemmaからの応答:", data.response);
        return data.response;
    } else {
        const errorData = await response.json();
        console.error("APIエラー:", errorData.error);
        return null;
    }
}

// 試してみるプロンプト
const myPrompt = "以下のレシピの分類を行ってください。\n\n [レシピ本文]\n (title)簡単チキンナゲット♪～鶏胸肉で～ (ingredientText)鶏むね肉６００ｇ 卵１個 酒・醤油・マヨネーズ各大さじ１ 小麦粉大さじ６ 塩小さじ１弱 こしょう適量\n[回答]\n";
//const myPrompt = "以下のレシピの分類を行ってください。\n\n  [レシピ本文]\n  (title)おいし～い☆うちの回鍋肉（ホイコーロー） (ingredientText)キャベツ大きめの葉4～5枚 ピーマン3個 豚バラ切り落とし200～300ｇ （下味用 酒大さじ2＋しょうゆ小さじ1/2） 片栗粉1/3カップ しょうが、にんにく各1切 ☆オイスターソース大さじ1～2 ☆豆板醤小さじ1/4 ☆しょうゆ小さじ1/2 ☆味噌小さじ1 ☆みりん大さじ1 ☆酒大さじ1 サラダ油・ごま油各大さじ1\n[回答]\n";

callGemmaAPI(myPrompt);