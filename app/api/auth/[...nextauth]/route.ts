import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth'; // authOptionsをlib/authからインポート

// NextAuth関数に、エクスポートしたauthOptionsを渡してハンドラを生成します。
const handler = NextAuth(authOptions);

// 生成されたハンドラを、GETリクエストとPOSTリクエストの両方に対応するようにエクスポートします。
export { handler as GET, handler as POST };
