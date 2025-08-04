////////////////////////////////////////////////////////////////////////////////////////////////
//
// ナビゲーションバー
//
// こっちの方がしっくりくる。こっちの前提で進める。
// 課題は位置の固定（fixedにすると、横にずれてしまう。）
//
////////////////////////////////////////////////////////////////////////////////////////////////
"use client";
import React, { useState } from 'react';
import Link from "next/link"
import Image from "next/image"
import { useSession, signOut } from 'next-auth/react';

/**
 * ナビゲーションバー
 * @returns ナビゲーションバーコンポーネント
 */
export default function NavBar() {
  // スマホ画面でのハンバーガーメニューオープン状態
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();
  
  return (
      <div className="fixed inset-x-0 w-screen z-50 px-4 lg:px-10 text-gray-800 bg-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link className="" href="/">
              <Image src="/logo.png" width={70} height={70} alt="Tukuome 3rd" />
            </Link>
            <span className="ml-4 text-sm">ようこそ, {session?.user?.name}さん</span>
          </div>
          <div className="flex items-center">
            <div className="hidden lg:block ">
              <ul className="flex flex-col lg:flex-row justify-center lg:justify-end items-end">
                <Link href="/recipes/tags" className="block px-2 py-2 text-center">タグ検索</Link>
                <Link href="/recipes/folders" className="block px-2 py-2 text-center">フォルダ</Link>
                <Link href="/recipes/Authers" className="block px-2 py-2 text-center">作者一覧</Link>
                <li>
                  <button onClick={() => signOut()} className="block px-2 py-2 text-center">ログアウト</button>
                </li>
              </ul>
            </div>
            <button className="lg:hidden" onClick={()=> {setIsOpen(!isOpen)}}>
              <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                <path d="M24 6h-24v-4h24v4zm0 4h-24v4h24v-4zm0 8h-24v4h24v-4z"/>
              </svg>    
            </button>
          </div>
        </div>
        <div className={isOpen?"block":"hidden"}>
          <ul className="flex flex-col lg:flex-row justify-center lg:justify-end items-center">
            <Link href="/recipes/tags" onClick={()=> {setIsOpen(!isOpen)}} className="block px-2 py-2 text-center">タグ検索</Link>
            <Link href="/recipes/folders" onClick={()=> {setIsOpen(!isOpen)}} className="block px-2 py-2 text-center">フォルダ</Link>
            <Link href="/recipes/Authers" onClick={()=> {setIsOpen(!isOpen)}} className="block px-2 py-2 text-center">作者一覧</Link>
            <li>
              <button onClick={() => signOut()} className="block px-2 py-2 text-center">ログアウト</button>
            </li>
          </ul>
        </div>
      </div>
  )
}