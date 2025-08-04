import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import React from 'react';
import NavBar from "@/app/components/NavBar"; // NavBarをインポート

export default async function RecipesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <>
      <NavBar />
      <div className="pt-[130px]">
        {children}
      </div>
    </>
  );
}

