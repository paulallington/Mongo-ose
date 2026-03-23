import * as esbuild from 'esbuild';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

// Plugin: strip ESM __dirname shims — CJS already has __dirname built-in
const fixDirnamePlugin = {
  name: 'fix-dirname',
  setup(build) {
    build.onLoad({ filter: /\.(ts|js)$/, namespace: 'file' }, async (args) => {
      const fsP = await import('fs/promises');
      let contents = await fsP.readFile(args.path, 'utf8');
      contents = contents.replace(
        /const __dirname = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);?\r?\n?/g,
        ''
      );
      contents = contents.replace(
        /import \{ fileURLToPath \} from ['"]url['"];?\r?\n?/g,
        ''
      );
      return {
        contents,
        loader: args.path.endsWith('.ts') ? 'ts' : 'js',
      };
    });
  }
};

console.log('Bundling server...');
await esbuild.build({
  entryPoints: [path.join(ROOT, 'server', 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(ROOT, 'server-bundle', 'server.cjs'),
  plugins: [fixDirnamePlugin],
});
console.log('Server bundled to server-bundle/server.cjs');
