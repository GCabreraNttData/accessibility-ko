import fs from 'fs';

let md = '';
let jsonFile = 'accesibility-report.json';
if (fs.existsSync(jsonFile)) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  md = `# Accessibility Report for ${data.file}\n\n`;
  for (const v of data.violations) {
    md += `## [${v.impact.toUpperCase()}] ${v.help}\n`;
    md += `**Rule:** ${v.id}\n\n`;
    md += `**Description:** ${v.description}\n\n`;
    for (const node of v.nodes) {
      md += `- **File:** ${node.file}  \n`;
      md += `  **Line:** ${node.line ?? 'N/A'}  \n`;
      md += `  **Selector:** \`${node.target.join(' ')}\`  \n`;
      md += `  **HTML:** \`${node.html}\`\n`;
    }
    md += '\n';
  }
} else {
  md = '# Accessibility Report\n\nNo se encontró accesibility-report.json.\n\nEl test de accesibilidad no se ejecutó correctamente o no se generó el informe JSON.';
}

fs.writeFileSync('accesibility-report.md', md);
console.log('Markdown report generated: accesibility-report.md');

// Generar HTML sencillo a partir del mismo contenido
let html = '';
if (fs.existsSync(jsonFile)) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>Accessibility Report</title>\n<style>body{font-family:sans-serif;margin:2em;}h1{color:#2c3e50;}h2{color:#c0392b;}pre,code{background:#f4f4f4;padding:2px 4px;border-radius:3px;}section{margin-bottom:2em;}ul{padding-left:1.2em;}li{margin-bottom:0.5em;}hr{margin:2em 0;}</style>\n</head>\n<body>\n`;
  html += `<h1>Accessibility Report for ${data.file}</h1>\n`;
  for (const v of data.violations) {
    html += `<section><h2>[${v.impact.toUpperCase()}] ${v.help}</h2>\n`;
    html += `<strong>Rule:</strong> ${v.id}<br>`;
    html += `<strong>Description:</strong> ${v.description}<br><ul>`;
    for (const node of v.nodes) {
      html += `<li><strong>File:</strong> ${node.file}<br>`;
      html += `<strong>Line:</strong> ${node.line ?? 'N/A'}<br>`;
      html += `<strong>Selector:</strong> <code>${node.target.join(' ')}</code><br>`;
      html += `<strong>HTML:</strong> <code>${node.html}</code></li>`;
    }
    html += `</ul></section><hr>`;
  }
  html += `</body>\n</html>`;
} else {
  html = `<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"UTF-8\"><title>Accessibility Report</title></head><body><h1>Accessibility Report</h1><p>No se encontró accesibility-report.json.<br>El test de accesibilidad no se ejecutó correctamente o no se generó el informe JSON.</p></body></html>`;
}
fs.writeFileSync('accesibility-report.html', html);
console.log('HTML report generated: accesibility-report.html');