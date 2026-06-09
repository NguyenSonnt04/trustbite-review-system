import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactCompiler: true,
  turbopack: {
    root: clientRoot,
  },
};

export default nextConfig;
