import { execSync } from 'child_process';

console.log('Building CRTransfer with Vite...');

console.log('Building WASM...');
try {
  execSync('cd src/wasm && wasm-pack build --target web --release', { stdio: 'inherit' });
} catch (error) {
  console.error('WASM build failed:', error.message);
  process.exit(1);
}

console.log('WASM files ready in src/wasm/pkg');

console.log('Building Vite...');
try {
  execSync('vite build --mode production', { stdio: 'inherit', cwd: process.cwd() });
} catch (error) {
  console.error('Vite build failed:', error.message);
  process.exit(1);
}

console.log('Build complete!');