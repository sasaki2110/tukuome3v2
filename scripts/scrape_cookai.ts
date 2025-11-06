#!/usr/bin/env tsx
/**
 * cookai-recipe.com からCookpadレシピをスクレイピングするスクリプト
 * 
 * 機能:
 * 1. カテゴリページを再帰的にスクレイピング
 * 2. 記事ページからCookpadリンクを取得
 * 3. Cookpadページから情報を抽出（タイトル、画像URL、作者等）
 * 4. 直接DBのrepoテーブルへインサート
 */

import * as cheerio from 'cheerio';
import { insertRecipe } from '../lib/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface ScrapedResult {
  url: string;
  title: string | null;
  image_url: string | null;
  author: string | null;
  recipe_id: string | null;
  tsukurepo_count: number | null;
}

class CookAIScraper {
  private delay: number;
  private visitedUrls: Set<string> = new Set();
  private visitedArticleUrls: Set<string> = new Set();
  private visitedCookpadUrls: Set<string> = new Set();
  private cookpadUrls: Set<string> = new Set();
  public results: ScrapedResult[] = [];
  private headers: HeadersInit;

  constructor(delay: number = 1000) {
    this.delay = delay;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getPage(url: string): Promise<{ soup: cheerio.CheerioAPI | null; finalUrl: string | null }> {
    if (this.visitedUrls.has(url)) {
      return { soup: null, finalUrl: null };
    }

    try {
      console.log(`取得中: ${url}`);
      const response = await fetch(url, {
        headers: this.headers,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const finalUrl = response.url;
      const html = await response.text();
      this.visitedUrls.add(url);
      await this.sleep(this.delay);
      
      const soup = cheerio.load(html) as cheerio.CheerioAPI;
      return { soup, finalUrl };
    } catch (error) {
      console.error(`エラー (${url}): ${error}`);
      return { soup: null, finalUrl: null };
    }
  }

  private getArticleUrlsFromCategory(soup: cheerio.CheerioAPI, categoryUrl: string): Set<string> {
    const articleUrls = new Set<string>();
    const links = soup('a[href]');

    links.each((_, element) => {
      const href = soup(element).attr('href');
      if (!href) return;

      const fullUrl = new URL(href, categoryUrl).href;
      
      // 記事ページのURLパターン
      if (/\/[\w-]+\/\d+\.html/.test(href) || 
          (href.startsWith('/') && href.endsWith('.html') && href.split('/').length >= 3)) {
        articleUrls.add(fullUrl);
      }
    });

    return articleUrls;
  }

  private getPaginationUrls(soup: cheerio.CheerioAPI, categoryUrl: string): Set<string> {
    const paginationUrls = new Set<string>();
    const links = soup('a[href]');
    const baseCategory = categoryUrl.split('?')[0];

    links.each((_, element) => {
      const href = soup(element).attr('href');
      if (!href) return;

      const fullUrl = new URL(href, categoryUrl).href;
      
      // ページネーションリンク
      if (href.includes('/page/') && fullUrl.includes('cookai-recipe.com')) {
        paginationUrls.add(fullUrl);
      } else if (fullUrl.includes(baseCategory) && (/page/i.test(href) || /page[/=]\d+/.test(href))) {
        paginationUrls.add(fullUrl);
      }
    });

    return paginationUrls;
  }

  async getCategoryUrls(baseUrl: string = "https://cookai-recipe.com"): Promise<Set<string>> {
    const { soup } = await this.getPage(baseUrl);
    if (!soup) return new Set();

    const categoryUrls = new Set<string>();
    const links = soup('a[href]');

    links.each((_, element) => {
      const href = soup(element).attr('href');
      if (!href) return;

      const fullUrl = new URL(href, baseUrl).href;
      
      if (href.includes('/category/') && !href.includes('/page/')) {
        if (fullUrl.includes('cookai-recipe.com') || href.startsWith('/category/')) {
          categoryUrls.add(fullUrl);
        }
      }
    });

    return categoryUrls;
  }

  async getTagUrls(baseUrl: string = "https://cookai-recipe.com", categoryUrls?: Set<string>): Promise<Set<string>> {
    const tagUrls = new Set<string>();
    
    // トップページからタグを取得
    const { soup } = await this.getPage(baseUrl);
    if (soup) {
      const links = soup('a[href]');
      links.each((_, element) => {
        const href = soup(element).attr('href');
        if (!href) return;

        const fullUrl = new URL(href, baseUrl).href;
        
        if (href.includes('/tag/') && !href.includes('/page/')) {
          if (fullUrl.includes('cookai-recipe.com') || href.startsWith('/tag/')) {
            tagUrls.add(fullUrl);
          }
        }
      });
    }

    // カテゴリページからもタグを取得（オプション）
    if (categoryUrls) {
      console.log('  カテゴリページからタグを取得中...');
      const categoryUrlsList = Array.from(categoryUrls).slice(0, 5);
      for (const catUrl of categoryUrlsList) {
        const { soup: catSoup } = await this.getPage(catUrl);
        if (catSoup) {
          const catLinks = catSoup('a[href]');
          catLinks.each((_, element) => {
            const href = catSoup(element).attr('href');
            if (!href) return;

            const fullUrl = new URL(href, catUrl).href;
            
            if (href.includes('/tag/') && !href.includes('/page/')) {
              if (fullUrl.includes('cookai-recipe.com') || href.startsWith('/tag/')) {
                tagUrls.add(fullUrl);
              }
            }
          });
        }
      }
    }

    return tagUrls;
  }

  async getCookpadUrlsFromArticle(articleUrl: string): Promise<Set<string>> {
    if (this.visitedArticleUrls.has(articleUrl)) {
      console.log(`  [スキップ] 既に訪問済み: ${articleUrl}`);
      return new Set();
    }

    const { soup } = await this.getPage(articleUrl);
    if (!soup) return new Set();

    this.visitedArticleUrls.add(articleUrl);
    const cookpadUrls = new Set<string>();
    const links = soup('a[href]');

    links.each((_, element) => {
      const href = soup(element).attr('href');
      if (!href) return;

      if (href.includes('cookpad.com/recipe/')) {
        const fullUrl = new URL(href, articleUrl).href;
        // URLを正規化（クエリパラメータやフラグメントを除去）
        const url = new URL(fullUrl);
        const normalized = `${url.protocol}//${url.host}${url.pathname}`;
        cookpadUrls.add(normalized);
      }
    });

    return cookpadUrls;
  }

  async scrapeCookpadPage(cookpadUrl: string): Promise<ScrapedResult | null> {
    if (this.visitedCookpadUrls.has(cookpadUrl)) {
      console.log(`  [スキップ] 既に訪問済み: ${cookpadUrl}`);
      return null;
    }

    const { soup, finalUrl } = await this.getPage(cookpadUrl);
    if (!soup) return null;

    this.visitedCookpadUrls.add(cookpadUrl);
    const actualUrl = finalUrl || cookpadUrl;
    
    if (finalUrl && finalUrl !== cookpadUrl) {
      this.visitedCookpadUrls.add(finalUrl);
    }

    const result: ScrapedResult = {
      url: actualUrl,
      title: null,
      image_url: null,
      author: null,
      recipe_id: null,
      tsukurepo_count: null
    };

    // タイトル
    const titleTag = soup('title').first();
    if (titleTag.length > 0) {
      result.title = titleTag.text().trim();
    }

    // h1タグからタイトルを取得
    const h1Tag = soup('h1').first();
    if (h1Tag.length > 0) {
      const h1Text = h1Tag.text().trim();
      if (h1Text && h1Text.length > 0) {
        result.title = h1Text;
      }
    }

    // 画像URL
    // alt属性に「レシピのメイン写真」や「レシピ-メイン写真」が含まれるimgタグを探す
    const mainImages = soup('img[alt]');
    mainImages.each((_, element) => {
      const altText = soup(element).attr('alt') || '';
      if (altText.includes('レシピ') && (altText.includes('メイン写真') || altText.includes('メイン-写真'))) {
        const src = soup(element).attr('src');
        if (src && src.startsWith('http')) {
          result.image_url = src;
          return false; // break
        }
      }
    });

    // 見つからない場合はog:imageを試す
    if (!result.image_url) {
      const ogImage = soup('meta[property="og:image"]').first();
      if (ogImage.length > 0) {
        result.image_url = ogImage.attr('content') || null;
      }
    }

    // 作者情報
    // href="/jp/users/..." を持つaタグを探す
    const userLinks = soup('a[href*="/jp/users/"]');
    userLinks.each((_, element) => {
      const authorSpan = soup(element).find('span.font-semibold').first();
      if (authorSpan.length > 0) {
        const authorText = authorSpan.text().trim();
        if (authorText && authorText.length > 0) {
          result.author = authorText;
          return false; // break
        }
      }
    });

    // レシピIDをURLから抽出
    // 新形式: /jp/recipes/22635859
    const newFormatMatch = actualUrl.match(/\/jp\/recipes\/(\d+)/);
    if (newFormatMatch) {
      result.recipe_id = newFormatMatch[1];
    } else {
      // 旧形式の場合: /recipe/723956
      const oldFormatMatch = actualUrl.match(/\/recipe\/(\d+)/);
      if (oldFormatMatch) {
        result.recipe_id = oldFormatMatch[1];
      }
    }

    // つくれぽ数
    // 方法1: JSON-LDのcommentCountから取得
    const jsonLdScripts = soup('script[type="application/ld+json"]');
    jsonLdScripts.each((_, element) => {
      try {
        const scriptContent = soup(element).html();
        if (!scriptContent) return;
        const data = JSON.parse(scriptContent);
        if (typeof data === 'object' && data !== null && 'commentCount' in data) {
          result.tsukurepo_count = parseInt(String(data.commentCount), 10);
          return false; // break
        }
      } catch (e) {
        // JSONパースエラーは無視
      }
    });

    // 方法2: data-cooksnapped-count-cooksnaps-count-value属性から取得
    if (result.tsukurepo_count === null) {
      const cooksnappedDiv = soup('div[data-cooksnapped-count-cooksnaps-count-value]').first();
      if (cooksnappedDiv.length > 0) {
        const countValue = cooksnappedDiv.attr('data-cooksnapped-count-cooksnaps-count-value');
        if (countValue) {
          const count = parseInt(countValue, 10);
          if (!isNaN(count)) {
            result.tsukurepo_count = count;
          }
        }
      }
    }

    return result;
  }

  async insertRecipeToDb(result: ScrapedResult): Promise<boolean> {
    // つくれぽ数が500未満の場合はスキップ
    const tsukurepoCount = result.tsukurepo_count;
    if (tsukurepoCount === null || tsukurepoCount < 500) {
      return false;
    }

    // 必須フィールドの取得
    const recipeId = result.recipe_id;
    const imageUrl = result.image_url || '';
    let title = result.title || '';
    const author = result.author || '';

    // recipe_idが無い場合はスキップ
    if (!recipeId) {
      return false;
    }

    // タイトルに「 by 作者名」を追加
    if (author) {
      title = `${title} by ${author}`;
    }

    try {
      await insertRecipe('sysop', {
        id_n: parseInt(recipeId, 10),
        image: imageUrl,
        title: title,
        tsukurepo: String(tsukurepoCount),
        tags: [],
        isMain: 0,
        isSub: 0
      });
      console.log(`    -> DBにインサートしました: ${title.substring(0, 50)}`);
      return true;
    } catch (error) {
      // 一意制約違反のエラーパターンをチェック（SQLite/PostgreSQL両対応）
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isUniqueConstraintError = 
        errorMessage.includes('UNIQUE constraint failed') ||
        errorMessage.includes('duplicate key value violates unique constraint') ||
        errorMessage.includes('violates unique constraint') ||
        errorMessage.includes('duplicate key');
      
      if (isUniqueConstraintError) {
        console.log(`    -> スキップ（既に存在）: ${title.substring(0, 50)}`);
        return false;
      } else {
        console.error(`    -> DBインサートエラー: ${error}`);
        // 一意制約違反以外のエラーはスキップして処理を続行
        return false;
      }
    }
  }

  async scrapeCategory(categoryUrl: string, maxPages: number = 10): Promise<ScrapedResult[]> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`カテゴリページをスクレイピング開始: ${categoryUrl}`);
    console.log(`${'='.repeat(60)}`);

    // ページネーションURLを取得
    const { soup: categorySoup } = await this.getPage(categoryUrl);
    if (!categorySoup) return [];

    const paginationUrls = this.getPaginationUrls(categorySoup, categoryUrl);
    const allCategoryUrls = new Set([categoryUrl, ...paginationUrls]);
    
    // 最大ページ数に制限
    const categoryUrlsList = Array.from(allCategoryUrls).slice(0, maxPages);
    console.log(`処理するカテゴリページ数: ${categoryUrlsList.length}`);

    // 各カテゴリページから記事URLを取得
    const allArticleUrls = new Set<string>();
    for (const catUrl of categoryUrlsList) {
      const { soup: catSoup } = await this.getPage(catUrl);
      if (catSoup) {
        const articleUrls = this.getArticleUrlsFromCategory(catSoup, catUrl);
        articleUrls.forEach(url => allArticleUrls.add(url));
        console.log(`  ${catUrl}: ${articleUrls.size}件の記事が見つかりました`);
      }
    }

    console.log(`\n合計記事数: ${allArticleUrls.size}`);

    // 訪問済みの記事URLを除外
    const unvisitedArticleUrls = new Set(
      Array.from(allArticleUrls).filter(url => !this.visitedArticleUrls.has(url))
    );
    const skippedCount = allArticleUrls.size - unvisitedArticleUrls.size;
    if (skippedCount > 0) {
      console.log(`訪問済み記事数（スキップ）: ${skippedCount}`);
    }
    console.log(`処理対象記事数: ${unvisitedArticleUrls.size}`);

    // 各記事ページからCookpadリンクを取得
    console.log(`\n記事ページからCookpadリンクを取得中...`);
    const articleUrlsArray = Array.from(unvisitedArticleUrls);
    for (let i = 0; i < articleUrlsArray.length; i++) {
      const articleUrl = articleUrlsArray[i];
      console.log(`  [${i + 1}/${articleUrlsArray.length}] ${articleUrl}`);
      const cookpadUrls = await this.getCookpadUrlsFromArticle(articleUrl);
      cookpadUrls.forEach(url => this.cookpadUrls.add(url));
      console.log(`    -> ${cookpadUrls.size}件のCookpadリンクが見つかりました`);
    }

    console.log(`\n合計Cookpadリンク数: ${this.cookpadUrls.size}`);

    // 訪問済みのCookpadURLを除外
    const unvisitedCookpadUrls = new Set(
      Array.from(this.cookpadUrls).filter(url => !this.visitedCookpadUrls.has(url))
    );
    const skippedCookpadCount = this.cookpadUrls.size - unvisitedCookpadUrls.size;
    if (skippedCookpadCount > 0) {
      console.log(`訪問済みCookpadリンク数（スキップ）: ${skippedCookpadCount}`);
    }
    console.log(`処理対象Cookpadリンク数: ${unvisitedCookpadUrls.size}`);

    // Cookpadページをスクレイピング
    console.log(`\nCookpadページをスクレイピング中...`);
    const cookpadUrlsArray = Array.from(unvisitedCookpadUrls);
    for (let i = 0; i < cookpadUrlsArray.length; i++) {
      const cookpadUrl = cookpadUrlsArray[i];
      console.log(`  [${i + 1}/${cookpadUrlsArray.length}] ${cookpadUrl}`);
      try {
        const result = await this.scrapeCookpadPage(cookpadUrl);
        if (result) {
          this.results.push(result);
          const tsukurepo = result.tsukurepo_count || 0;
          console.log(`    -> タイトル: ${(result.title || 'N/A').substring(0, 50)}`);
          console.log(`    -> つくれぽ数: ${tsukurepo}`);
          // DBにインサート（エラーが発生しても処理を続行）
          await this.insertRecipeToDb(result);
        }
      } catch (error) {
        console.error(`    -> エラーが発生しましたが処理を続行: ${error}`);
      }
    }

    return this.results;
  }

  async scrapeTag(tagUrl: string, maxPages: number = 10): Promise<ScrapedResult[]> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`タグページをスクレイピング開始: ${tagUrl}`);
    console.log(`${'='.repeat(60)}`);

    // ページネーションURLを取得
    const { soup: tagSoup } = await this.getPage(tagUrl);
    if (!tagSoup) return [];

    const paginationUrls = this.getPaginationUrls(tagSoup, tagUrl);
    const allTagUrls = new Set([tagUrl, ...paginationUrls]);
    
    // 最大ページ数に制限
    const tagUrlsList = Array.from(allTagUrls).slice(0, maxPages);
    console.log(`処理するタグページ数: ${tagUrlsList.length}`);

    // 各タグページから記事URLを取得
    const allArticleUrls = new Set<string>();
    for (const tgUrl of tagUrlsList) {
      const { soup: tgSoup } = await this.getPage(tgUrl);
      if (tgSoup) {
        const articleUrls = this.getArticleUrlsFromCategory(tgSoup, tgUrl);
        articleUrls.forEach(url => allArticleUrls.add(url));
        console.log(`  ${tgUrl}: ${articleUrls.size}件の記事が見つかりました`);
      }
    }

    console.log(`\n合計記事数: ${allArticleUrls.size}`);

    // 訪問済みの記事URLを除外
    const unvisitedArticleUrls = new Set(
      Array.from(allArticleUrls).filter(url => !this.visitedArticleUrls.has(url))
    );
    const skippedCount = allArticleUrls.size - unvisitedArticleUrls.size;
    if (skippedCount > 0) {
      console.log(`訪問済み記事数（スキップ）: ${skippedCount}`);
    }
    console.log(`処理対象記事数: ${unvisitedArticleUrls.size}`);

    // 各記事ページからCookpadリンクを取得
    console.log(`\n記事ページからCookpadリンクを取得中...`);
    const articleUrlsArray = Array.from(unvisitedArticleUrls);
    for (let i = 0; i < articleUrlsArray.length; i++) {
      const articleUrl = articleUrlsArray[i];
      console.log(`  [${i + 1}/${articleUrlsArray.length}] ${articleUrl}`);
      const cookpadUrls = await this.getCookpadUrlsFromArticle(articleUrl);
      cookpadUrls.forEach(url => this.cookpadUrls.add(url));
      console.log(`    -> ${cookpadUrls.size}件のCookpadリンクが見つかりました`);
    }

    console.log(`\n合計Cookpadリンク数: ${this.cookpadUrls.size}`);

    // 訪問済みのCookpadURLを除外
    const unvisitedCookpadUrls = new Set(
      Array.from(this.cookpadUrls).filter(url => !this.visitedCookpadUrls.has(url))
    );
    const skippedCookpadCount = this.cookpadUrls.size - unvisitedCookpadUrls.size;
    if (skippedCookpadCount > 0) {
      console.log(`訪問済みCookpadリンク数（スキップ）: ${skippedCookpadCount}`);
    }
    console.log(`処理対象Cookpadリンク数: ${unvisitedCookpadUrls.size}`);

    // Cookpadページをスクレイピング
    console.log(`\nCookpadページをスクレイピング中...`);
    const cookpadUrlsArray = Array.from(unvisitedCookpadUrls);
    for (let i = 0; i < cookpadUrlsArray.length; i++) {
      const cookpadUrl = cookpadUrlsArray[i];
      console.log(`  [${i + 1}/${cookpadUrlsArray.length}] ${cookpadUrl}`);
      try {
        const result = await this.scrapeCookpadPage(cookpadUrl);
        if (result) {
          this.results.push(result);
          const tsukurepo = result.tsukurepo_count || 0;
          console.log(`    -> タイトル: ${(result.title || 'N/A').substring(0, 50)}`);
          console.log(`    -> つくれぽ数: ${tsukurepo}`);
          // DBにインサート（エラーが発生しても処理を続行）
          await this.insertRecipeToDb(result);
        }
      } catch (error) {
        console.error(`    -> エラーが発生しましたが処理を続行: ${error}`);
      }
    }

    return this.results;
  }

  async scrapeAllCategories(categoryUrls: string[], maxPages: number = 10): Promise<ScrapedResult[]> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`複数カテゴリのスクレイピングを開始`);
    console.log(`処理対象カテゴリ数: ${categoryUrls.length}`);
    console.log(`${'='.repeat(80)}`);

    for (let idx = 0; idx < categoryUrls.length; idx++) {
      const categoryUrl = categoryUrls[idx];
      console.log(`\n${'#'.repeat(80)}`);
      console.log(`カテゴリ ${idx + 1}/${categoryUrls.length}: ${categoryUrl}`);
      console.log(`${'#'.repeat(80)}`);
      
      await this.scrapeCategory(categoryUrl, maxPages);
      
      console.log(`\nカテゴリ ${idx + 1}/${categoryUrls.length} の処理が完了しました`);
      console.log(`現在の累計結果数: ${this.results.length}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`全カテゴリのスクレイピングが完了しました`);
    console.log(`${'='.repeat(80)}`);

    return this.results;
  }

  async scrapeAllTags(tagUrls: string[], maxPages: number = 10): Promise<ScrapedResult[]> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`複数タグのスクレイピングを開始`);
    console.log(`処理対象タグ数: ${tagUrls.length}`);
    console.log(`${'='.repeat(80)}`);

    for (let idx = 0; idx < tagUrls.length; idx++) {
      const tagUrl = tagUrls[idx];
      console.log(`\n${'#'.repeat(80)}`);
      console.log(`タグ ${idx + 1}/${tagUrls.length}: ${tagUrl}`);
      console.log(`${'#'.repeat(80)}`);
      
      await this.scrapeTag(tagUrl, maxPages);
      
      console.log(`\nタグ ${idx + 1}/${tagUrls.length} の処理が完了しました`);
      console.log(`現在の累計結果数: ${this.results.length}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`全タグのスクレイピングが完了しました`);
    console.log(`${'='.repeat(80)}`);

    return this.results;
  }

  getStats() {
    return {
      visitedUrls: this.visitedUrls.size,
      visitedArticleUrls: this.visitedArticleUrls.size,
      visitedCookpadUrls: this.visitedCookpadUrls.size,
      cookpadUrls: this.cookpadUrls.size,
      results: this.results.length
    };
  }
}

async function main() {
  // 最大ページ数の指定（オプション）
  // tsx実行時: process.argv[0]=node, [1]=tsx, [2]=スクリプトファイル名, [3]=最初の引数
  const maxPages = process.argv[3] && /^\d+$/.test(process.argv[3]) 
    ? parseInt(process.argv[3], 10) 
    : 10;
  
  const scraper = new CookAIScraper(1000); // 1秒待機
  
  // トップページからカテゴリとタグのURLを取得
  const topUrl = "https://cookai-recipe.com/";
  console.log(`\n${'='.repeat(80)}`);
  console.log(`トップページからカテゴリとタグを取得中: ${topUrl}`);
  console.log(`${'='.repeat(80)}`);
  
  const categoryUrls = Array.from(await scraper.getCategoryUrls(topUrl));
  console.log(`\n取得したカテゴリ数: ${categoryUrls.length}`);
  
  if (categoryUrls.length > 0) {
    console.log(`\nカテゴリ一覧:`);
    categoryUrls.forEach(catUrl => {
      console.log(`  - ${catUrl}`);
    });
  }
  
  // タグを取得（カテゴリページからも取得を試みる）
  const tagUrls = Array.from(await scraper.getTagUrls(topUrl, new Set(categoryUrls)));
  console.log(`\n取得したタグ数: ${tagUrls.length}`);
  
  if (tagUrls.length > 0) {
    console.log(`\nタグ一覧:`);
    tagUrls.forEach(tagUrl => {
      console.log(`  - ${tagUrl}`);
    });
  } else {
    console.log(`\n警告: タグが見つかりませんでした。サイト構造を確認してください。`);
  }
  
  // カテゴリを順番にスクレイピング
  if (categoryUrls.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`カテゴリのスクレイピングを開始`);
    console.log(`${'='.repeat(80)}`);
    await scraper.scrapeAllCategories(categoryUrls, maxPages);
  }
  
  // タグを順番にスクレイピング
  if (tagUrls.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`タグのスクレイピングを開始`);
    console.log(`${'='.repeat(80)}`);
    await scraper.scrapeAllTags(tagUrls, maxPages);
  }
  
  // サマリー表示
  const stats = scraper.getStats();
  console.log(`\n${'='.repeat(60)}`);
  console.log("スクレイピング完了");
  console.log(`${'='.repeat(60)}`);
  console.log(`訪問したURL数: ${stats.visitedUrls}`);
  console.log(`訪問した記事ページ数: ${stats.visitedArticleUrls}`);
  console.log(`訪問したCookpadページ数: ${stats.visitedCookpadUrls}`);
  console.log(`取得したCookpadリンク数: ${stats.cookpadUrls}`);
  console.log(`成功したスクレイピング数: ${stats.results}`);
  
  if (stats.results > 0) {
    console.log(`\n最初の10件の結果:`);
    scraper.results.slice(0, 10).forEach((result, i) => {
      console.log(`\n${i + 1}. ${result.title || 'N/A'}`);
      console.log(`   画像: ${result.image_url || 'N/A'}`);
      console.log(`   作者: ${result.author || 'N/A'}`);
      const tsukurepo = result.tsukurepo_count;
      if (tsukurepo !== null) {
        console.log(`   つくれぽ数: ${tsukurepo}`);
      } else {
        console.log(`   つくれぽ数: N/A`);
      }
      console.log(`   URL: ${result.url}`);
    });
  }
}

main().catch(error => {
  console.error('エラーが発生しました:', error);
  process.exit(1);
});

