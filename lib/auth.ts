import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// --- 認証に使用するユーザーデータの定義 ---
// 本番環境では、この部分はデータベースへの問い合わせ処理に置き換える必要があります。
// 例: Prisma, TypeORMなどを使ってデータベースからユーザー情報を取得する。
const users = [
  { id: '1', username: 'sahamaru', name: 'sahamaru' },
  { id: '2', username: 'tonkati', name: 'tonkati' },
  { id: '3', username: 'sasaking', name: 'sasaking' },
  { id: '4', username: 'sara', name: 'sara' },
];

// --- NextAuthの設定オブジェクトを定義し、エクスポートします ---
// getServerSessionはこのauthOptionsを参照してセッション情報を取得します。
export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/login',
  },
  // --- 認証プロバイダの設定 ---
  // ここにアプリケーションで使用したい認証方法を配列で指定します。
  // Google, GitHubなど、複数のプロバイダを追加することも可能です。
  providers: [
    // CredentialsProviderは、ユーザー名とパスワードのような資格情報による認証を提供します。
    CredentialsProvider({
      // name: この認証方法の名前。NextAuthが自動生成するログインページなどで使われます。
      // 好きな名前に変更可能ですが、'Credentials'のままが一般的です。
      name: 'Credentials',

      // credentials: ユーザーにどのような情報の入力を求めるかを定義します。
      // ここのキー（例: 'username'）が、authorize関数のcredentials引数の型に影響します。
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'jsmith' },
      },

      // authorize: ユーザーが入力した情報を検証するコアロジック。
      // ★★★ この関数はサーバーサイドでのみ実行されます ★★★
      // そのため、データベースアクセスやAPIキーを使った処理などを安全に記述できます。
      async authorize(credentials) {
        // credentials引数には、上で定義したcredentialsのキーを持つオブジェクトが渡されます。
        // 型は Record<"username", string> | undefined となります。
        if (!credentials) {
          return null; // 入力がない場合は認証失敗
        }

        // 入力されたユーザー名とダミーのユーザーデータを照合します。
        // 実際には、ここでデータベースに問い合わせを行います。
        const user = users.find(u => u.username === credentials.username);

        if (user) {
          // ユーザーが見つかった場合、そのユーザーオブジェクトを返します。
          // null以外のオブジェクトを返すと、NextAuth.jsは認証成功と判断します。
          // このオブジェクトがセッション情報やJWTに格納されるベースとなります。
          return user;
        } else {
          // ユーザーが見つからなかった場合、nullを返します。
          return null;
        }
      },
    }),
  ],
  // ここに他のNextAuthの設定（例: callbacks, pages, sessionなど）を追加できます。
};
