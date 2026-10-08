import { defineConfig } from '../node_modules/vite/dist/node/index.js';
import react from '../node_modules/@vitejs/plugin-react-swc/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
// Never let Vite look in the project root for .env.local.
export default defineConfig({root:path.resolve(here,'..'),envDir:path.join(here,'env'),plugins:[react()],resolve:{alias:{'@':path.resolve(here,'../src')}},server:{host:'127.0.0.1',port:4187,strictPort:true},build:{outDir:path.join(here,'artifacts/build')}});

