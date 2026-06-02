import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

// Parse command-line flags
const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const isWatch = args.includes('--watch');
const validateOnly = args.includes('--validate-only');

// Resolve entry point relative to this script
const entryPoint = path.resolve(process.cwd(), 'scripts/main.js');

// Validate entry point exists if requested or before building
if (validateOnly || !validateOnly) {
  if (!fs.existsSync(entryPoint)) {
    console.error(`Entry point not found: ${entryPoint}`);
    process.exit(1);
  }

  if (validateOnly) {
    console.log('✓ Entry point validated');
    process.exit(0);
  }
}

// esbuild configuration
const buildConfig = {
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'browser',
  target: ['chrome100'],
  format: 'iife',
  globalName: 'GMTOOLKIT_BUNDLE',
  outfile: 'dist/pf2e-gm-toolkit.bundle.js',
  minify: !isDev,
  sourcemap: isDev ? true : false,
  external: [
    'foundry',
    'game',
    'canvas',
    'ui',
    'Hooks',
    'Actor',
    'Item',
    'Token',
    'Scene',
    'JournalEntry',
    'Folder',
    'TokenDocument',
    'Combat',
    'Combatant',
  ],
};

async function build() {
  try {
    const result = await esbuild.build({
      ...buildConfig,
      watch: isWatch ? { onRebuild: onRebuild } : false,
    });

    // Get output file size
    const outputPath = buildConfig.outfile;
    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`✓ Build complete: ${outputPath} (${sizeKB} KB)`);

    if (isWatch) {
      console.log('Watching for changes...');
    }
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

function onRebuild(error, result) {
  if (error) {
    console.error('Rebuild error:', error.message);
  } else {
    const stats = fs.statSync(buildConfig.outfile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✓ Rebuilt: ${buildConfig.outfile} (${sizeKB} KB)`);
  }
}

build();
