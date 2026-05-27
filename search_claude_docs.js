import * as fs from 'fs';

const docsPath = 'C:\\Users\\Shadi\\.gemini\\antigravity\\brain\\0b4a67db-1794-42b7-ad3f-af510958c742\\.system_generated\\steps\\4720\\content.md';
if (fs.existsSync(docsPath)) {
  const content = fs.readFileSync(docsPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  
  // Search for lines mentioning Claude or Anthropic
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('claude') || line.toLowerCase().includes('anthropic')) {
      console.log(`[Line ${idx + 1}] ${line.trim().substring(0, 150)}`);
    }
  });
} else {
  console.log('Docs file not found at path:', docsPath);
}
