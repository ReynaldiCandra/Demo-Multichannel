import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Mengizinkan akses dev dari perangkat lain di jaringan yang sama (mis. HP).
  // Ganti IP sesuai jaringan Anda; menghilangkan peringatan "Cross origin request".
  allowedDevOrigins: ['192.168.1.6'],
};

export default nextConfig;
