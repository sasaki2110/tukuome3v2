"use server";

import { z } from "zod";
import { loadMasterTagsFromDb, updateMasterTagsInDb } from "@/lib/services";
import { revalidatePath } from "next/cache";

export async function loadMasterTags(
  gen: 0 | 1
) {
  try {
    const data = await loadMasterTagsFromDb(gen);
    return { success: true, data };
  } catch (error) {
    console.error(error);
    return { success: false, message: "マスタータグの読み込みに失敗しました。" };
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

  try {
    await updateMasterTagsInDb(masterTags);
    
    revalidatePath("/recipes/tags/maintenance"); // 現在のページを再検証
    revalidatePath("/recipes"); // レシピ一覧も再検証

    return { success: true, message: "タグを更新しました。" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "タグの更新に失敗しました。" };
  }
}
