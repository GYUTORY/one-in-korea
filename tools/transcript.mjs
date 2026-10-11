// 일생 기록 덤프: 선택 화면(제목·설명·모든 선택지·잠금 사유·고른 것)과 로그를 나이순으로 출력한다. 검수용.
// 사용법: node tools/transcript.mjs [N=1] [seed=1] [year] [gender M|F] [income 1~5]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const [N = 1, seed = 1, year, gender, income] = process.argv.slice(2);
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const engine = html.split('<script>')[1].split('/* =========================================================\n   UI')[0];
// 재현 가능한 난수
let s = +seed >>> 0 || 1;
const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const ctx = { window: { __headless: true }, localStorage: { getItem: () => null, setItem() {} }, console, Math: Object.create(Math, { random: { value: rand } }) };
vm.createContext(ctx);
vm.runInContext(engine + `
globalThis.__run=function(o){
  const S=newLife(o),out=[],strip=t=>String(t).replace(/<br>/g,' / ').replace(/<[^>]+>/g,'');let li=0,g=0;
  const flush=()=>{while(li<S.log.length){const l=S.log[li++];out.push('  '+l.a+'세 '+l.y+' ['+l.k+'] '+strip(l.t))}};
  while(!S.dead&&g++<1500){
    if(S.pending){let k=0;while(S.pending&&k++<20){flush();
      const id=S.pending,c=CHOICES[id](S);
      const av=c.options.map((o,i)=>[i,(o.lock||o.failed)?0:(o.w??1)]).filter(x=>x[1]>0);
      let i=av.length?wpick(av):c.options.length-1;
      if(id==='job'&&S.failed.length>4)i=c.options.findIndex(o=>o.job&&o.job.id==='parttime');
      const ch=c.options[i];
      out.push('▶ '+S.age+'세 '+S.year+' 〈'+id+'〉 '+strip(c.title)+' — '+strip(c.desc||''));
      if(c.kind==='jobs'){const ok=c.options.filter(o=>!o.lock).length;out.push('    (직업 목록 '+c.options.length+'개, 지원 가능 '+ok+') → '+(ch.job?ch.job.n:ch.label))}
      else c.options.forEach((o,j)=>out.push('    '+(j===i?'●':'○')+' '+strip(o.label)+(o.sub?' · '+strip(o.sub):'')+(o.lock?' 🔒'+strip(o.lock):'')));
      const r=resolve(S,i);if(r&&r.fail){out.push('    ✗ 실패: '+strip(r.msg||''));if(id==='job'){/* 재시도 */}}
    }continue}
    advance(S)}
  flush();
  out.push('■ 끝: '+S.age+'세 · 순자산 '+fmt(net(S))+' · 직업 '+S.jobsDone.map(id=>JOB[id].n).join(' → '));
  const hdr='### '+S.birthYear+'년생 '+(S.gender==='M'?'남':'여')+' · '+REGIONS[S.region].n+' · 소득 '+S.fq+'분위';
  return hdr+'\\n'+out.join('\\n');
}`, ctx);
for (let i = 0; i < +N; i++) {
  const o = {}; if (year) o.year = +year; if (gender) o.gender = gender; if (income) o.income = income;
  console.log(ctx.__run(o) + '\n');
}
