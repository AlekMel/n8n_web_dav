const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Создание директорий, если они не существуют
const dirs = ['dist', 'dist/credentials', 'dist/nodes/WebDav', 'dist/nodes/WebDav/icons'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Компиляция TypeScript
console.log('Компиляция TypeScript...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('Компиляция завершена успешно.');
} catch (error) {
  console.error('Ошибка компиляции:', error);
  process.exit(1);
}

// Копирование SVG файлов
console.log('Копирование SVG файлов...');
try {
  fs.copyFileSync(
    path.join(__dirname, 'src/nodes/WebDav/webdav.svg'),
    path.join(__dirname, 'dist/nodes/WebDav/webdav.svg')
  );
  console.log('SVG файлы скопированы.');
} catch (error) {
  console.error('Ошибка копирования SVG:', error);
}

console.log('Сборка завершена!'); 