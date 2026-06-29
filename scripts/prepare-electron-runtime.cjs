const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const runtimeNames = [
  'msvcp140.dll',
  'msvcp140_1.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll',
];

function copyIfDifferent(sourcePath, targetPath) {
  const source = fs.statSync(sourcePath);
  const targetExists = fs.existsSync(targetPath);

  if (targetExists) {
    const target = fs.statSync(targetPath);
    if (target.size === source.size && target.mtimeMs >= source.mtimeMs) {
      return false;
    }
  }

  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function compareVersions(a, b) {
  const left = String(a || '').split(/[.-]/).map((segment) => Number.parseInt(segment, 10) || 0);
  const right = String(b || '').split(/[.-]/).map((segment) => Number.parseInt(segment, 10) || 0);
  const maxLength = Math.max(left.length, right.length);

  for (let i = 0; i < maxLength; i += 1) {
    const leftValue = left[i] || 0;
    const rightValue = right[i] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, files);
      continue;
    }
    files.push(entryPath);
  }

  return files;
}

function getElectronExecutableName() {
  if (process.platform === 'darwin') {
    return 'Electron.app/Contents/MacOS/Electron';
  }
  if (process.platform === 'win32') {
    return 'electron.exe';
  }
  return 'electron';
}

function getElectronCacheDirs() {
  const home = os.homedir();
  const dirs = [
    process.env.ELECTRON_CACHE,
    process.env.npm_config_cache ? path.join(process.env.npm_config_cache, 'electron') : null,
    path.join(home, 'Library', 'Caches', 'electron'),
    path.join(home, '.cache', 'electron')
  ];

  return dirs.filter(Boolean);
}

function findCachedElectronArchive(version) {
  const platformArch = `${process.platform}-${process.arch}`;
  const archives = [];

  for (const cacheDir of getElectronCacheDirs()) {
    for (const filePath of walkFiles(cacheDir)) {
      const fileName = path.basename(filePath);
      const match = fileName.match(/^electron-v(.+)-([^-]+-[^.]+)\.zip$/);
      if (!match || match[2] !== platformArch) {
        continue;
      }
      archives.push({ filePath, version: match[1] });
    }
  }

  if (archives.length === 0) {
    return null;
  }

  const exact = archives.find((archive) => archive.version === version);
  if (exact) {
    return exact;
  }

  archives.sort((a, b) => compareVersions(b.version, a.version));
  return archives[0];
}

function ensureElectronFromLocalCache(projectRoot) {
  const electronDir = path.join(projectRoot, 'node_modules', 'electron');
  const packagePath = path.join(electronDir, 'package.json');
  const pathFile = path.join(electronDir, 'path.txt');
  const distDir = path.join(electronDir, 'dist');
  const executableName = getElectronExecutableName();
  const executablePath = path.join(distDir, executableName);

  if (!fs.existsSync(packagePath)) {
    return;
  }
  if (fs.existsSync(pathFile) && fs.existsSync(executablePath)) {
    return;
  }

  const electronPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const archive = findCachedElectronArchive(electronPackage.version);
  if (!archive) {
    return;
  }

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  execFileSync('unzip', ['-q', archive.filePath, '-d', distDir], { stdio: 'inherit' });
  fs.writeFileSync(pathFile, executableName);

  if (fs.existsSync(executablePath)) {
    fs.chmodSync(executablePath, 0o755);
  }

  console.log(
    `[prepare-electron-runtime] using cached Electron ${archive.version} from ${archive.filePath}`
  );
}

function syncWindowsRuntimeDlls(projectRoot) {
  if (process.platform !== 'win32') {
    return;
  }

  const sourceDir = path.join(projectRoot, 'resources', 'runtime', 'win32');
  const targetDir = path.join(projectRoot, 'node_modules', 'electron', 'dist');

  if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
    return;
  }

  let copiedCount = 0;

  for (const name of runtimeNames) {
    const sourcePath = path.join(sourceDir, name);
    const targetPath = path.join(targetDir, name);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    if (copyIfDifferent(sourcePath, targetPath)) {
      copiedCount += 1;
    }
  }

  if (copiedCount > 0) {
    console.log(`[prepare-electron-runtime] synced ${copiedCount} runtime DLL(s) to ${targetDir}`);
  }
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');

  ensureElectronFromLocalCache(projectRoot);
  syncWindowsRuntimeDlls(projectRoot);
}

main();
