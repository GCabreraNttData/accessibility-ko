import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';

// Opción para salida JSON en pipelines
const args = process.argv.slice(2);
const fileNameArg = args.find(a => !a.startsWith('--'));
const outputJson = args.includes('--json');
const fileName2 = fileNameArg;
if (!fileName2) {
  console.error('Usage: node accesibilidad-axe.mjs <file.html> [--json]');
  process.exit(1);
}

const html = fs.readFileSync(path.resolve(fileName2), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost' });
const { window } = dom;

// Asigna window y document al global antes de importar axe-core
global.window = window;
global.document = window.document;

// Importa axe-core dinámicamente después de definir los globals
const axe = (await import('axe-core')).default;

window.eval(axe.source);

axe.run(window.document, {
  rules: {
    'color-contrast': { enabled: false }
  }
}, (err, results) => {
  if (err) throw err;
  if (outputJson) {
    // Salida JSON para CI/CD
    const summary = {
      file: fileName2,
      violations: results.violations.map(v => ({
        id: v.id,
        impact: ['image-alt','label','link-name'].includes(v.id) ? 'critical' : v.impact,
        help: v.help,
        description: v.description,
        nodes: v.nodes.map(n => {
          // Calcular ruta relativa y línea para cada nodo
          const projectRoot = process.cwd();
          const relPath = path.relative(projectRoot, fileName2).replace(/\\/g, '/');
          let line = null;
          if (n.html) {
            const htmlContent = fs.readFileSync(path.resolve(fileName2), 'utf8');
            const lines = htmlContent.split(/\r?\n/);
            // Buscar la línea con más coincidencias de atributos
            const attrRegex = /([a-zA-Z0-9\-:]+)=("[^"]*"|'[^']*')/g;
            let attrs = [];
            let match;
            while ((match = attrRegex.exec(n.html)) !== null) {
              attrs.push(match[0]);
            }
            let bestLine = -1, bestCount = 0;
            for (let i = 0; i < lines.length; i++) {
              let count = 0;
              for (const attr of attrs) {
                if (lines[i].includes(attr)) count++;
              }
              if (count > bestCount) {
                bestCount = count;
                bestLine = i;
              }
            }
            if (bestLine === -1) {
              const fragment = n.html.trim().substring(0, 30);
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(fragment)) {
                  bestLine = i;
                  break;
                }
              }
            }
            if (bestLine === -1) {
              const tagMatch = n.html.trim().match(/^<([a-zA-Z0-9\-]+)/);
              let tag = tagMatch ? tagMatch[1] : null;
              if (tag) {
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes('<' + tag)) {
                    bestLine = i;
                    break;
                  }
                }
              }
            }
            if (bestLine !== -1) line = bestLine + 1;
          }
          return {
            html: n.html,
            target: n.target,
            file: relPath,
            line: line
          };
        })
      }))
    };
    fs.writeFileSync('accesibility-report.json', JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    // Solo fallar si hay errores critical o serious
    const fail = summary.violations.some(v => v.impact === 'critical' || v.impact === 'serious');
    process.exit(fail ? 1 : 0);
  }
  if (results.violations.length === 0) {
    console.log(chalk.green('Sin problemas de accesibilidad.'));
  } else {
    results.violations.forEach(v => {
      // Forzar ciertas reglas como 'critical'
      const forceCritical = ['image-alt', 'label', 'link-name'];
      let impact = v.impact;
      if (forceCritical.includes(v.id)) {
        impact = 'critical';
      }
      // Separador de ancho completo
      const sep = '-'.repeat(Math.max(20, process.stdout.columns || 80));
      console.log(chalk.gray(sep));
      let typeColored = `[${impact}]`;
      if (impact === 'critical') typeColored = chalk.rgb(204,51,0)('[CRITICAL]');
      else if (impact === 'serious') typeColored = chalk.rgb(255,153,102)('[SERIOUS]');
      else if (impact === 'moderate') typeColored = chalk.rgb(255,204,0)('[MODERATE]');
      else if (impact === 'minor') typeColored = chalk.rgb(153,204,51)('[MINOR]');
      console.log(`  ${typeColored} ${chalk.bold(v.help)}`);
      console.log(`    Code: ${chalk.cyan(v.id)}`);
      if (v.description) {
        console.log(`    Description: ${chalk.white(v.description)}`);
      }
      v.nodes.forEach((node, idx, arr) => {
        // Calcular ruta relativa
        const projectRoot = process.cwd();
        const relPath = path.relative(projectRoot, fileName2).replace(/\\/g, '/');
        let lineInfo = '';
        let bestLine = -1;
        if (node.html) {
          const htmlContent = fs.readFileSync(path.resolve(fileName2), 'utf8');
          const lines = htmlContent.split(/\r?\n/);
          const attrRegex = /([a-zA-Z0-9\-:]+)=("[^"]*"|'[^']*')/g;
          let attrs = [];
          let match;
          while ((match = attrRegex.exec(node.html)) !== null) {
            attrs.push(match[0]);
          }
          let bestLines = [];
          let bestCount = 0;
          for (let i = 0; i < lines.length; i++) {
            let count = 0;
            for (const attr of attrs) {
              if (lines[i].includes(attr)) count++;
            }
            if (count > bestCount) {
              bestCount = count;
              bestLines = [i];
            } else if (count === bestCount && count > 0) {
              bestLines.push(i);
            }
          }
          bestLine = bestLines.length > 0 ? bestLines[0] : -1;
          if (bestLine === -1) {
            const fragment = node.html.trim().substring(0, 30);
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(fragment)) {
                bestLine = i;
                break;
              }
            }
          }
          if (bestLine === -1) {
            const tagMatch = node.html.trim().match(/^<([a-zA-Z0-9\-]+)/);
            let tag = tagMatch ? tagMatch[1] : null;
            if (tag) {
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('<' + tag)) {
                  bestLine = i;
                  break;
                }
              }
            }
          }
          let end = -1;
          if (bestLine !== -1) {
            const tagMatch = node.html.trim().match(/^<([a-zA-Z0-9\-]+)/);
            let tag = tagMatch ? tagMatch[1] : null;
            if (tag) {
              const closing = `</${tag}>`;
              for (let j = bestLine; j < lines.length; j++) {
                if (lines[j].includes(closing)) {
                  end = j;
                  break;
                }
              }
            }
            if (end === -1) {
              for (let j = lines.length - 1; j > bestLine; j--) {
                if (node.html.includes(lines[j].trim())) {
                  end = j;
                  break;
                }
              }
            }
            if (end > bestLine) {
              lineInfo = ` Lines: ${bestLine + 1}-${end + 1}`;
            } else if (bestLine !== -1) {
              lineInfo = ` Line: ${bestLine + 1}`;
            }
          }
        }
        // Mostrar ruta y línea(s)
        if (relPath) {
          console.log(chalk.green(`    File: ${relPath}${lineInfo}`));
          // Comprobar si hay más de un nodo con el mismo selector y línea
          const sameLineAndHtml = arr.filter((n, j) => {
            if (!n.html) return false;
            let l = -1;
            const htmlContent = fs.readFileSync(path.resolve(fileName2), 'utf8');
            const lines = htmlContent.split(/\r?\n/);
            const attrRegex = /([a-zA-Z0-9\-:]+)=("[^"]*"|'[^']*')/g;
            let attrs = [];
            let m;
            while ((m = attrRegex.exec(n.html)) !== null) {
              attrs.push(m[0]);
            }
            let bestLines = [];
            let bestCount = 0;
            for (let i = 0; i < lines.length; i++) {
              let count = 0;
              for (const attr of attrs) {
                if (lines[i].includes(attr)) count++;
              }
              if (count > bestCount) {
                bestCount = count;
                bestLines = [i];
              } else if (count === bestCount && count > 0) {
                bestLines.push(i);
              }
            }
            l = bestLines.length > 0 ? bestLines[0] : -1;
            if (l === -1) {
              const fragment = n.html.trim().substring(0, 30);
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(fragment)) {
                  l = i;
                  break;
                }
              }
            }
            if (l === -1) {
              const tagMatch = n.html.trim().match(/^<([a-zA-Z0-9\-]+)/);
              let tag = tagMatch ? tagMatch[1] : null;
              if (tag) {
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes('<' + tag)) {
                    l = i;
                    break;
                  }
                }
              }
            }
            return l === bestLine && n.html === node.html;
          });
          if (sameLineAndHtml.length > 1 && sameLineAndHtml[0] === node) {
            console.log(chalk.yellow(`    Note: There are ${sameLineAndHtml.length} identical selectors with this same error. The marked line is the first one.`));
          }
        }
        // Mostrar selector
        if (node.html) console.log(chalk.blue(`    Selector: ${node.html}`));
      });
    });
    // Separador de ancho completo al final
    const sep = '-'.repeat(Math.max(20, process.stdout.columns || 80));
    console.log(chalk.gray(sep));
  }
});