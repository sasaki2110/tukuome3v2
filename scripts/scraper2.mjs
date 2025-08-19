// 必要: Node.js v18+ (fetch 標準対応)
// cheerio 必須: npm install cheerio
// ファイル出力に fs/promises を使用

import * as cheerio from 'cheerio';
import { writeFile } from 'fs/promises';

const BASE_URL = "https://cookpad.com/jp/users/40038971/recipes";
const OUTPUT_FILE = "./public/me2gemini/cookpad_links.csv";

async function scrapeCookpad() {
  const seen = new Set(); // 重複排除用
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const url = page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
    console.log(`ページ取得中: ${url}`);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Bot/0.1; +https://example.com)"
      }
    });

    if (!res.ok) {
      console.error(`HTTPエラー: ${res.status}`);
      break;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // ID抽出
    const ids = [];
    $("[data-search-tracking-result-id]").each((i, el) => {
      const id = $(el).attr("data-search-tracking-result-id");
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    });

    if (ids.length === 0) {
      // そのページに新しいIDがなければ終了とみなす
      hasNext = false;
    }

    page++;
  }

  // URL化して配列に変換
  const urls = Array.from(seen).map(id => `https://cookpad.com/jp/recipes/${id}`);

  // 1行ずつ表示
  urls.forEach(url => console.log(url));

  // CSVとして出力
  const csvContent = urls.join("\n") + "\n";
  await writeFile(OUTPUT_FILE, csvContent, "utf-8");

  console.log(`\n${OUTPUT_FILE} に保存しました (${urls.length} 件)`);
}

scrapeCookpad();
