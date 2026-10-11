// 직업별로 뜰 수 있는 직장 상황(WEV)과 연간 사건(JEV)을 모두 출력한다. 검수용.
// 사용법: node tools/event-matrix.mjs [직업id...]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const engine = html.split('<script>')[1].split('/* =========================================================\n   UI')[0];
const ctx = { window: { __headless: true }, localStorage: { getItem: () => null, setItem() {} }, console, only: process.argv.slice(2) };
vm.createContext(ctx);
vm.runInContext(engine + `
for(const j of JOBS){ if(j.hidden||(only.length&&!only.includes(j.id))) continue;
  const S={job:{id:j.id,start:20,sal:j.s},wevSeen:{},stress:50,year:2025,age:40,gender:'F',edu:{tier:3},money:0,married:true,kids:1,kidsAge:36,region:'capital',sib:'첫째',fam:{dad:{role:'아버지',alive:true,age:78},mom:{role:'어머니',alive:true,age:75}}};
  const wk=wkOf(S),c=j.c;
  const pool=WEV.filter(e=>(e.who||['emp']).includes(wk)&&(!e.cats||e.cats.includes(c))&&(!e.ok||e.ok(S)));
  const w=pool.map(e=>{const dd=(WEV_ID_D[e.id]||{})[j.id]||wevTxt(e.d,S);const opts=e.o.filter(o=>!(o===JH&&wk!=='emp')&&(!o.who||o.who.includes(wk))).map(o=>wevTxt(o.l,S)).join(' / ');
    return '   ◆ '+wevTxt(e.t,S)+': '+dd.replace(/<[^>]+>/g,'')+'\\n      → '+opts}).join('\\n');
  const jv=(jevFor(S)||[]).filter(x=>!x.c||x.c(S)).map(x=>x.t).join(' | ');
  console.log('■ '+j.n+' ('+j.id+', '+c+', '+wk+')\\n'+w+'\\n   ● 연간: '+jv+'\\n');
}`, ctx);
