import * as esbuild from 'esbuild';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RELEASE = path.join(ROOT, 'release');

// Clean release dir
if (fs.existsSync(RELEASE)) {
  fs.rmSync(RELEASE, { recursive: true });
}
fs.mkdirSync(RELEASE);

// 1. Build client
console.log('Building client...');
execFileSync('npm', ['run', 'build'], { cwd: path.join(ROOT, 'client'), stdio: 'inherit', shell: true });

// 2. Bundle server into a single CJS file
console.log('Bundling server...');

// Plugin: strip ESM __dirname shims — CJS already has __dirname built-in
const fixDirnamePlugin = {
  name: 'fix-dirname',
  setup(build) {
    build.onLoad({ filter: /\.(ts|js)$/, namespace: 'file' }, async (args) => {
      const fsP = await import('fs/promises');
      let contents = await fsP.readFile(args.path, 'utf8');
      // Remove "const __dirname = path.dirname(fileURLToPath(import.meta.url))"
      contents = contents.replace(
        /const __dirname = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);?\r?\n?/g,
        ''
      );
      // Remove the unused fileURLToPath import
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

await esbuild.build({
  entryPoints: [path.join(ROOT, 'server', 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(RELEASE, 'server.cjs'),
  plugins: [fixDirnamePlugin],
});

// 3. Copy client dist → release/public (embedded in pkg snapshot)
console.log('Copying client files...');
fs.cpSync(
  path.join(ROOT, 'client', 'dist'),
  path.join(RELEASE, 'public'),
  { recursive: true }
);

// 4. Create a minimal package.json for pkg
fs.writeFileSync(path.join(RELEASE, 'package.json'), JSON.stringify({
  name: 'mongo-ose',
  version: '1.0.0',
  bin: 'server.cjs',
  pkg: {
    assets: ['public/**/*'],
    targets: ['node20-win-x64'],
    outputPath: '.',
    compress: 'GZip',
  },
}, null, 2));

// 5. Package into exe
console.log('Packaging executable...');
execFileSync('npx', ['pkg', '.'], { cwd: RELEASE, stdio: 'inherit', shell: true });

// 6. Stamp the mongoose icon onto the exe
console.log('Setting exe icon...');
const { rcedit } = await import('rcedit');
await rcedit(path.join(RELEASE, 'mongo-ose.exe'), {
  icon: path.join(ROOT, 'client', 'public', 'favicon.ico'),
});

// 7. Clean up intermediate files
fs.rmSync(path.join(RELEASE, 'server.cjs'));
fs.rmSync(path.join(RELEASE, 'public'), { recursive: true });
fs.rmSync(path.join(RELEASE, 'package.json'));

console.log('\nDone! Executable: release/mongo-ose.exe');
console.log('Distribute this single file. On first run it creates a data/ folder next to it.');
