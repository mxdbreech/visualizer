import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteLoader from 'vite-svg-loader'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), viteLoader()],
})
