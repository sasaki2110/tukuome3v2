import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
   images: {
     remotePatterns: [
       {
         protocol: 'https',
         hostname: 'img.cpcdn.com',
         port: '',
         pathname: '/recipes/**',
       },
       {
         protocol: 'https',
         hostname: 'img-global-jp.cpcdn.com',
         port: '',
         pathname: '/recipes/**',
       },
     ],
   },
};

export default nextConfig;
