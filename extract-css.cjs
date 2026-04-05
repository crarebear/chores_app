const fs = require('fs');
const html = fs.readFileSync('index.backup.html', 'utf8');
const startToken = '<style>';
const endToken = '</style>';
const start = html.indexOf(startToken) + startToken.length;
const end = html.indexOf(endToken, start);
const css = html.substring(start, end);

fs.mkdirSync('src/styles', { recursive: true });
fs.writeFileSync('src/styles/index.css', css);
console.log('src/styles/index.css created');
