import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn } from 'node:child_process'
import http from 'node:http'

function converterServicePlugin(): Plugin {
  let child: ReturnType<typeof spawn> | null = null;

  return {
    name: 'auto-converter-service',
    configureServer(server) {
      if (process.env.VITEST === 'true') {
        return;
      }
      const checkHealth = () =>
        new Promise<boolean>((resolve) => {
          const req = http.get('http://127.0.0.1:7860/health', (res) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.setTimeout(1200, () => {
            req.destroy();
            resolve(false);
          });
        });

      checkHealth().then((isUp) => {
        if (!isUp) {
          console.log('\n[ShrinkByte] Auto-starting Adobe Converter Service on http://127.0.0.1:7860...');
          child = spawn('py', ['-m', 'uvicorn', 'main:app', '--app-dir', 'converter-service', '--host', '127.0.0.1', '--port', '7860'], {
            stdio: 'inherit',
            shell: true,
          });

          child.on('error', () => {
            child = spawn('python', ['-m', 'uvicorn', 'main:app', '--app-dir', 'converter-service', '--host', '127.0.0.1', '--port', '7860'], {
              stdio: 'inherit',
              shell: true,
            });
          });
        } else {
          console.log('\n[ShrinkByte] Adobe Converter Service is active on http://127.0.0.1:7860');
        }
      });

      const killChild = () => {
        if (child) {
          try {
            child.kill();
          } catch {}
          child = null;
        }
      };

      server.httpServer?.on('close', killChild);
      process.on('exit', killChild);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    converterServicePlugin(),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/convert': 'http://127.0.0.1:7860',
      '/health': 'http://127.0.0.1:7860',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdf';
          }
          if (id.includes('node_modules/tesseract.js')) {
            return 'vendor-ocr';
          }
          if (id.includes('node_modules/@xenova/transformers')) {
            return 'vendor-transformers';
          }
          if (id.includes('node_modules/fabric') || id.includes('node_modules/html2canvas')) {
            return 'vendor-canvas';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
  },
})

