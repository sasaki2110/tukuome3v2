"use server";

import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { updateTags as updateTagsInService } from "@/lib/services";
import { revalidatePath } from "next/cache";

// masterTags.txt の内容をパースするロジック
function parseMasterTags(text: string): { id: number; level: number; dispName: string; name: string }[] {
  const lines = text.trim().split('\n');
  const results: { id: number; level: number; dispName: string; name: string }[] = [];

  // ヘッダー行をスキップ
  const dataLines = lines.slice(1);

  let idCounter = 1; // IDの連番

  for (const line of dataLines) {

    const columns = line.split('\t');
    
    let lastNonEmptyIndex = -1;
    for (let i = columns.length - 1; i >= 0; i--) {
        if (columns[i].trim() !== '') {
            lastNonEmptyIndex = i;
            break;
        }
    }

    if (lastNonEmptyIndex === -1) continue;

    const level = lastNonEmptyIndex;
    const dispName = columns[lastNonEmptyIndex].trim();

    const nameParts: string[] = [];
    for (let i = 0; i <= lastNonEmptyIndex; i++) {
        // 空の列があった場合、その前の階層までの情報でnameを構築するべきか？
        // asisの例だと単純結合なので、ここでも単純結合する
        nameParts.push(columns[i].trim());
    }
    const name = nameParts.join('');

    if (dispName) {
      results.push({
        id: idCounter++,
        level,
        dispName,
        name,
      });
    }
  }
  return results;
}

async function getMasterTagPath(fileName: string): Promise<string> {
  return path.join(process.cwd(), "public", fileName);
}

export async function loadMasterTags(
  fileName: "masterTags.txt" | "masterTags_bak.txt"
) {
  try {
    const filePath = await getMasterTagPath(fileName);
    const data = await fs.readFile(filePath, "utf8");
    return { success: true, data };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { success: true, data: "" }; // ファイルが存在しない場合は空文字を返す
    }
    console.error(error);
    return { success: false, message: "ファイルの読み込みに失敗しました。" };
  }
}

const schema = z.object({
  masterTags: z.string().min(1, { message: "マスタータグは必須です。" }),
});

export async function updateTags(formData: FormData) {
  const validatedFields = schema.safeParse({
    masterTags: formData.get("masterTags"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: validatedFields.error.flatten().fieldErrors.masterTags?.join(", "),
    };
  }

  const { masterTags } = validatedFields.data;
  const masterTagPath = await getMasterTagPath("masterTags.txt");
  const backupTagPath = await getMasterTagPath("masterTags_bak.txt");

  try {
    // 1. バックアップ作成
    try {
      await fs.access(masterTagPath);
      await fs.copyFile(masterTagPath, backupTagPath);
    } catch (error) {
        // masterTags.txtが存在しない初回実行時は何もしない
    }

    // 2. 新しい内容を書き込み
    await fs.writeFile(masterTagPath, masterTags);

    // 3. テキストをパース
    const newTags = parseMasterTags(masterTags);

    // 4. DBを更新 (Service経由)
    await updateTagsInService(newTags);
    
    revalidatePath("/recipes/tags/maintenance"); // 現在のページを再検証
    revalidatePath("/recipes"); // レシピ一覧も再検証

    return { success: true, message: "タグを更新しました。" };
  } catch (error) {
    console.error(error);
    // エラー発生時はバックアップからリストアを試みる
    try {
      await fs.access(backupTagPath);
      await fs.copyFile(backupTagPath, masterTagPath);
    } catch (restoreError) {
      console.error("バックアップからのリストアに失敗しました。", restoreError);
       return { success: false, message: "更新に失敗し、バックアップからのリストアにも失敗しました。" };
    }
    return { success: false, message: "タグの更新に失敗しました。元の状態に復元しました。" };
  }
}
