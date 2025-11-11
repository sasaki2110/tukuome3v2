# タグマスタ検索問題修正計画

## 問題の概要

タグマスタの`name`フィールドがセパレータなしの文字列連結になっているため、部分一致検索で誤検索が発生している。

### 具体例
- **B**: "素材別	魚介	その他お魚" → `name`: "素材別魚介その他お魚"
- **A**: "素材別	魚介	その他" → `name`: "素材別魚介その他"

Aを検索したいのに、`LIKE '%その他%'`によりBもヒットしてしまう。

## 解決策

`tag`テーブルに`l`, `m`, `s`, `ss`カラムを追加し、階層構造を保持する。検索ロジックを部分一致から階層ベースの完全一致検索に変更する。

## 修正箇所一覧

### 1. データベーススキーマ変更

**ファイル**: データベース（手動実行）

**内容**: `tag`テーブルに`l`, `m`, `s`, `ss`カラムを追加

**SQL文**:
```sql
ALTER TABLE tag ADD COLUMN l VARCHAR(255) DEFAULT '';
ALTER TABLE tag ADD COLUMN m VARCHAR(255) DEFAULT '';
ALTER TABLE tag ADD COLUMN s VARCHAR(255) DEFAULT '';
ALTER TABLE tag ADD COLUMN ss VARCHAR(255) DEFAULT '';
```

**実行タイミング**: 実装前に実行

---

### 2. 型定義の修正

**ファイル**: `app/model/model.tsx`

**対象**: `Tag`型（37-62行目）

**変更内容**: `l`, `m`, `s`, `ss`フィールドを追加

**変更前**:
```typescript
export type Tag = {
    id: number,
    level: number,
    dispname: string,
    name: string,
}
```

**変更後**:
```typescript
export type Tag = {
    id: number,
    level: number,
    dispname: string,
    name: string,
    l: string,
    m: string,
    s: string,
    ss: string,
}
```

---

### 3. タグ生成ロジックの修正

**ファイル**: `lib/services.ts`

**対象**: `updateMasterTagsInDb`関数（309-387行目）

**変更内容**: `tag`テーブル生成時に`l`, `m`, `s`, `ss`を設定するように修正

**変更箇所1**: 型定義（340行目）

**変更前**:
```typescript
const tagsForTagTable: { id: number; level: number; dispname: string; name: string }[] = [];
```

**変更後**:
```typescript
const tagsForTagTable: { id: number; level: number; dispname: string; name: string; l: string; m: string; s: string; ss: string }[] = [];
```

**変更箇所2**: level 0（大タグ）の生成（347-353行目）

**変更前**:
```typescript
if (mt.l) {
  path.push(mt.l);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ id: tagTableIdCounter++, level: 0, dispname: mt.l, name });
    existingTagNames.add(name);
  }
}
```

**変更後**:
```typescript
if (mt.l) {
  path.push(mt.l);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ 
      id: tagTableIdCounter++, 
      level: 0, 
      dispname: mt.l, 
      name,
      l: mt.l,
      m: '',
      s: '',
      ss: ''
    });
    existingTagNames.add(name);
  }
}
```

**変更箇所3**: level 1（中タグ）の生成（356-363行目）

**変更前**:
```typescript
if (mt.m) {
  path.push(mt.m);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ id: tagTableIdCounter++, level: 1, dispname: mt.m, name });
    existingTagNames.add(name);
  }
}
```

**変更後**:
```typescript
if (mt.m) {
  path.push(mt.m);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ 
      id: tagTableIdCounter++, 
      level: 1, 
      dispname: mt.m, 
      name,
      l: mt.l,
      m: mt.m,
      s: '',
      ss: ''
    });
    existingTagNames.add(name);
  }
}
```

**変更箇所4**: level 2（小タグ）の生成（365-372行目）

**変更前**:
```typescript
if (mt.s) {
  path.push(mt.s);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ id: tagTableIdCounter++, level: 2, dispname: mt.s, name });
    existingTagNames.add(name);
  }
}
```

**変更後**:
```typescript
if (mt.s) {
  path.push(mt.s);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ 
      id: tagTableIdCounter++, 
      level: 2, 
      dispname: mt.s, 
      name,
      l: mt.l,
      m: mt.m,
      s: mt.s,
      ss: ''
    });
    existingTagNames.add(name);
  }
}
```

**変更箇所5**: level 3（極小タグ）の生成（374-381行目）

**変更前**:
```typescript
if (mt.ss) {
  path.push(mt.ss);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ id: tagTableIdCounter++, level: 3, dispname: mt.ss, name });
    existingTagNames.add(name);
  }
}
```

**変更後**:
```typescript
if (mt.ss) {
  path.push(mt.ss);
  const name = path.join('');
  if (!existingTagNames.has(name)) {
    tagsForTagTable.push({ 
      id: tagTableIdCounter++, 
      level: 3, 
      dispname: mt.ss, 
      name,
      l: mt.l,
      m: mt.m,
      s: mt.s,
      ss: mt.ss
    });
    existingTagNames.add(name);
  }
}
```

---

### 4. insertTags関数の修正

**ファイル**: `lib/db.ts`

**対象**: `insertTags`関数（442-446行目）

**変更内容**: INSERT文に`l`, `m`, `s`, `ss`カラムを追加

**変更前**:
```typescript
export async function insertTags(userId: string, tags: { id: number; level: number; dispname: string; name: string }[]): Promise<void> {
  for (const tag of tags) {
    await sql`INSERT INTO tag (userid, id, level, dispname, name) VALUES (${userId}, ${tag.id}, ${tag.level}, ${tag.dispname}, ${tag.name});`;
  }
}
```

**変更後**:
```typescript
export async function insertTags(userId: string, tags: { id: number; level: number; dispname: string; name: string; l: string; m: string; s: string; ss: string }[]): Promise<void> {
  for (const tag of tags) {
    await sql`INSERT INTO tag (userid, id, level, dispname, name, l, m, s, ss) VALUES (${userId}, ${tag.id}, ${tag.level}, ${tag.dispname}, ${tag.name}, ${tag.l}, ${tag.m}, ${tag.s}, ${tag.ss});`;
  }
}
```

---

### 5. getDispTagsOptimized関数の修正

**ファイル**: `lib/db.ts`

**対象**: `getDispTagsOptimized`関数（270-322行目）

**変更内容**: 部分一致検索（LIKE）を階層ベースの完全一致検索に変更

**変更箇所1**: SELECT文に`l`, `m`, `s`, `ss`を追加（276-279行目）

**変更前**:
```typescript
query = `
  SELECT
      t.id,
      t.dispname,
      t.name,
      (SELECT image FROM repo WHERE userid = $1 AND tag LIKE '%' || t.name || '%' ORDER BY reposu_n DESC, id_n DESC LIMIT 1) AS imageuri,
      (SELECT COUNT(*) FROM tag WHERE userid = $1 AND level = t.level + 1 AND name LIKE t.name || '%') AS child_tag_count,
      (SELECT COUNT(*) FROM repo WHERE userid = $1 AND tag LIKE '%' || t.name || '%') AS recipe_count
  FROM
      tag t
  WHERE
      t.userid = $1 AND t.level = $2
`;
```

**変更後**:
```typescript
query = `
  SELECT
      t.id,
      t.dispname,
      t.name,
      t.l,
      t.m,
      t.s,
      t.ss,
      (SELECT image FROM repo WHERE userid = $1 AND t.name = ANY(string_to_array(repo.tag, ' ')) ORDER BY reposu_n DESC, id_n DESC LIMIT 1) AS imageuri,
      (SELECT COUNT(*) FROM tag WHERE userid = $1 AND level = t.level + 1 AND (tag.l || tag.m || tag.s) LIKE (t.l || t.m || t.s) || '%') AS child_tag_count,
      (SELECT COUNT(*) FROM repo WHERE userid = $1 AND t.name = ANY(string_to_array(repo.tag, ' '))) AS recipe_count
  FROM
      tag t
  WHERE
      t.userid = $1 AND t.level = $2
`;
```

**変更箇所2**: 検索条件の分岐（289-295行目）

**変更前**:
```typescript
if (value === "") {
  query += ` ORDER BY t.id;`;
  params = [userId, level];
} else {
  query += ` AND t.name LIKE $3 || '%' ORDER BY t.id;`;
  params = [userId, level, value];
}
```

**変更後**:
```typescript
if (value === "") {
  query += ` ORDER BY t.id;`;
  params = [userId, level];
} else {
  query += ` AND t.l || t.m || t.s = $3 ORDER BY t.id;`;
  params = [userId, level, value];
}
```

**注意**: `l`, `m`, `s`, `ss`の未使用カラムは空白なので、`t.l || t.m || t.s`で連結することで、levelに応じた階層ベースの検索が可能になります。`value`パラメータは、親タグの`l`, `m`, `s`の組み合わせ（連結文字列）を渡す必要があります。

---

## 実装順序

1. **データベーススキーマ変更**（手動実行）
   - ALTER TABLE文を実行

2. **型定義の修正**
   - `app/model/model.tsx`の`Tag`型に`l`, `m`, `s`, `ss`を追加

3. **タグ生成ロジックの修正**
   - `lib/services.ts`の`updateMasterTagsInDb`関数を修正

4. **insertTags関数の修正**
   - `lib/db.ts`の`insertTags`関数を修正

5. **検索ロジックの修正**
   - `lib/db.ts`の`getDispTagsOptimized`関数を修正

6. **動作確認**
   - タグメンテナンス画面からタグを再生成
   - タグ検索が正しく動作することを確認

## 注意事項

1. **既存データの移行**: 既存の`tag`レコードは、タグメンテナンス画面から再生成することで対応

2. **getDispTagsOptimized関数の`value`パラメータ**: 現在は親タグの`name`（連結文字列）を渡していますが、階層ベース検索に変更する場合、呼び出し元で親タグの`l`, `m`, `s`, `ss`の組み合わせを渡すように修正が必要な可能性があります。呼び出し元を確認してください。

3. **getTagsByNamePattern関数**: この関数は`LIKE`検索のまま変更しません。パターン検索（例: "素材別%"）が必要なため、階層ベース検索には変更しません。

4. **テスト**: 修正後、以下のケースでテストしてください
   - "その他"で検索した場合、"その他お魚"がヒットしないこと
   - "その他お魚"で検索した場合、正しくヒットすること
   - 各レベルのタグ検索が正しく動作すること

