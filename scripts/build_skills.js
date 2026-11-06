#!/usr/bin/env node
// Genera web/skills/bundle.json a partir de skills/**/SKILL.md y skills/**/historial/*.md.
// El hash usa la misma función que el adaptador de n8n, así que una edición sin regenerar el bundle hace fallar la carga.
// Uso: node scripts/build_skills.js [--check]   (--check falla si el bundle publicado no coincide con los archivos)
const fs = require('fs');
const path = require('path');
const N = require('../agentes/nucleo.js');

const raiz = path.join(__dirname, '..');
const archivos = [];
for (const dir of fs.readdirSync(path.join(raiz, 'skills'))) {
  const base = path.join(raiz, 'skills', dir);
  if (!fs.statSync(base).isDirectory()) continue;
  archivos.push(path.join(base, 'SKILL.md'));
  const hist = path.join(base, 'historial');
  if (fs.existsSync(hist)) fs.readdirSync(hist).filter((f) => f.endsWith('.md')).forEach((f) => archivos.push(path.join(hist, f)));
}
const skills = archivos.map((f) => {
  const contenido = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const p = N.parsearSkill(contenido);
  if (!p.nombre || !p.version) throw new Error('Skill sin name/version: ' + f);
  if (!p.reglas.length) throw new Error('Skill sin sección Reglas: ' + f);
  if (!p.criterios.length) throw new Error('Skill sin Criterios de aceptación: ' + f);
  return { nombre: p.nombre, version: p.version, archivo: path.relative(raiz, f).replace(/\\/g, '/'), hash: N.hash(contenido), contenido };
});
const bundle = { generado_desde: 'skills/', skills };
const destino = path.join(raiz, 'web', 'skills', 'bundle.json');
const nuevo = JSON.stringify(bundle, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const actual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
  if (actual !== nuevo) { console.error('✗ web/skills/bundle.json no coincide con skills/. Ejecuta: node scripts/build_skills.js'); process.exit(1); }
  console.log('✓ bundle de skills al día (' + skills.length + ' archivos)');
} else {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, nuevo);
  console.log('✓ ' + skills.length + ' skills → web/skills/bundle.json');
  skills.forEach((s) => console.log('  ' + s.nombre + '@' + s.version + ' #' + s.hash));
}
