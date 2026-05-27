import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== '.databricks' && f !== 'playwright-report') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const searchTerms = ['jason', 'REP-JASON', 'COMP_DEMO', 'is_manager'];
const results = [];

walkDir(process.cwd(), (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js') && !filePath.endsWith('.jsx') && !filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  searchTerms.forEach(term => {
    let index = 0;
    while ((index = content.toLowerCase().indexOf(term.toLowerCase(), index)) !== -1) {
      const lineNum = content.substr(0, index).split('\n').length;
      results.push({ file: filePath, term, line: lineNum });
      index += term.length;
    }
  });
});

console.log(JSON.stringify(results, null, 2));
