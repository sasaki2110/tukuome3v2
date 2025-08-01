// クエリー結果の型宣言

// レシピ型（DB型）
export type Repo = {
    userid: string,
    id_n: number,
    image: string,
    title: string,
    rank: number,   // = 1 がいいね
    reposu_n: number,
    comment: string,
    tag: string,
    ismain: number, // = 9 が既読
    issub: number,  // 未使用
}

// タグ型（DB型）
export type Tag = {
    /// Windows 版とは異なり、mobile/web版は使いやすい形に成形

    /// 主キー（ソート用）
    id: number,

    /// タグのレベル
    /// 0:大タグ
    /// 1:中タグ
    /// 2:小タグ
    /// 3:極小タグ
    level: number,

    /// 表示用名称
    /// 
    /// レベルに合わせた位置の文字列
    /// 
    /// おかず　なら　おかず
    /// おかず肉　なら　肉
    /// おかず肉牛肉　なら　牛肉
    dispname: string,

    /// タグの識別子（大・中・小・極小を連結したもの）
    name: string,
}



// 表示用タグ型（DISP型）
export type DispTag = {
    /// 主キー（ソート用）
    id: number,

    /// 表示用名称
    /// 
    /// レベルに合わせた位置の文字列
    /// 
    /// おかず　なら　おかず
    /// おかず肉　なら　肉
    /// おかず肉牛肉　なら　牛肉
    dispname: string,

    /// タグの識別子（大・中・小・極小を連結したもの）
    name: string,

    /// タグ選択画面で表示するイメージのURI
    /// そのタグに含まれるレシピで、一番つくれぽ数の多いレシピのイメージURIを設定する
    imageuri: string,

    /// でも、タグにレシピが登録されていない場合もある
    /// その時に、画像（ないから真っ白）の上に白く表示名を書いても見えない。
    /// だから、レシピの無いタグは、黒で名前を表示したい。
    /// 
    /// だから、テキスト色が白か黒かを判断する為に、イメージURIがあるかどうかを設定
    /// 0:なし
    /// 1:あり
    hasimageuri: string,

    /// タグ選択画面で、子タグがあるからドリルダウンするか、子タグがないからレシピを表示するかを判断
    /// 画面上（処理上も）下記を設定する
    /// 子タグあり：▼（ドリルダウンできるイメージ）　このタグが選ばれると、子タグの検索に行く
    /// 子タグなし：そのタグに含まれるレシピの件数　　このタグが選ばれると、そのタグでレシピを検索するように一覧画面へ戻る
    hasschildren: string,
}

// 作者型
export type Auther = {
  name: string,
  recipesu: number,
  image: string,
}
