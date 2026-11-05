// Безэкранный прогон симуляции: node simtest.mjs [тэг] [дней]
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const R = path.resolve(import.meta.dirname, '..');
const ctx = { window:{}, console, performance:globalThis.performance };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(R, 'data/map.js'), 'utf8'), ctx);
const files = ['db', 'db_tech', 'world', 'mil', 'airnavy', 'diplo', 'ai'];
const all = files.map(f => fs.readFileSync(path.join(R, `js/${f}.js`), 'utf8')).join('\n');
ctx.__days = +process.argv[3] || 2200; ctx.__player = process.argv[2] || 'SWI';
const run = fs.readFileSync(path.join(import.meta.dirname, process.env.SIMBODY || 'simtest_body.js'), 'utf8');
vm.runInContext(all + '\n' + run, ctx, { filename:'all.js' });
