// 현실성 검증: index.html의 엔진을 브라우저 없이 N번 돌려 통계를 출력하고 기준을 어기면 exit 1.
// 사용법: node tools/realism-check.mjs [N=5000]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const N = +(process.argv[2] || 5000);
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const MARK = '/* =========================================================\n   UI';
const engine = html.split('<script>')[1].split(MARK)[0]; // DATA + ENGINE 구간만 (UI 제외)

const test = String.raw`
const out={err:0,deaths:[],start:{},prepStart:{},prepPass:{},prepYears:{},jobs:{},male:0,aiOut:{},wev:0,never:0};
for(let i=0;i<N;i++){try{
  const S=simulate({year:[1990,2000,2010][i%3]});
  out.deaths.push(S.age); if(S.gender==='M')out.male++; if(!S.jobsDone.length)out.never++;
  S.jobsDone.forEach(j=>out.jobs[j]=(out.jobs[j]||0)+1);
  S.log.forEach(l=>{const t=l.t.replace(/<[^>]+>/g,'');let m;
    if(m=t.match(/(.+?)\(으\)로 일을 시작했다/)){const n=m[1].replace(/^\S+\s/,'');(out.start[n]=out.start[n]||[]).push(l.a)}
    if(m=t.match(/이\(가\) 되기 위해 (.+?) 준비를 시작/))out.prepStart[m[1]]=(out.prepStart[m[1]]||0)+1;
    if(m=t.match(/(\d+)년의 준비 끝에 (.+?) 합격/)){out.prepPass[m[2]]=(out.prepPass[m[2]]||0)+1;(out.prepYears[m[2]]=out.prepYears[m[2]]||[]).push(+m[1])}
    if(/희망퇴직 서류|해고 통보|자리가 없었다|AI 전환 교육 과정/.test(t))out.aiOut[S.birthYear]=(out.aiOut[S.birthYear]||0)+1;
  });
  out.wev+=S.history.filter(h=>WEV.some(e=>e.t===h.title)).length;
}catch(e){out.err++;if(out.err<3)console.log(e.stack)}}
out.totalJobs=JOBS.filter(j=>!j.hidden).length;
globalThis.__out=out;`;

const ctx = { window: { __headless: true }, localStorage: { getItem: () => null, setItem() {} }, console, N };
vm.createContext(ctx);
vm.runInContext(engine + '\n' + test, ctx);
const o = ctx.__out;

const med = a => { a = [...a].sort((x, y) => x - y); return a[a.length >> 1]; };
const max = a => Math.max(...a);
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

console.log(`N=${N} · 오류 ${o.err} · 사망 나이 중앙값 ${med(o.deaths)} · 남아 ${(o.male / N * 100).toFixed(1)}% · 무직 평생 ${o.never}`);
console.log(`경험된 직업 ${Object.keys(o.jobs).length} / ${o.totalJobs} · 직장 상황 선택 1인당 ${(o.wev / N).toFixed(1)}회`);
console.log('\n[첫 출근 나이] 중앙값 / 최고');
const LIMITS = { '경찰관': 40, '소방관': 40, '9급 공무원': 50, '7급 공무원': 50, '대기업 사무직': 45, '대기업 엔지니어': 48, '빅테크 개발자': 48, '직업군인 (부사관)': 29, '의사': 46 };
for (const n of Object.keys(LIMITS)) {
  const a = o.start[n]; if (!a) continue;
  console.log(`  ${n.padEnd(12)} n=${String(a.length).padStart(4)}  중앙 ${med(a)}  최고 ${max(a)}`);
  check(max(a) <= LIMITS[n], `${n} 최고 시작 나이 ${max(a)} > ${LIMITS[n]}`);
}
console.log('\n[준비 과정] 시작 → 합격률 · 합격자 평균 준비년수');
Object.keys(o.prepStart).filter(k => o.prepStart[k] >= 20).sort((a, b) => o.prepStart[b] - o.prepStart[a]).forEach(k => {
  const y = o.prepYears[k] || [];
  console.log(`  ${k.padEnd(20)} 시작 ${String(o.prepStart[k]).padStart(5)}  합격 ${(100 * (o.prepPass[k] || 0) / o.prepStart[k]).toFixed(0).padStart(3)}%  ${y.length ? (y.reduce((a, b) => a + b, 0) / y.length).toFixed(1) + '년' : '-'}`);
});
console.log('\n[AI 실직] 출생연도별 1인당', Object.entries(o.aiOut).map(([k, v]) => `${k}: ${(v / (N / 3)).toFixed(2)}`).join(' | '));

check(o.err === 0, `엔진 오류 ${o.err}건`);
check(Math.abs(o.male / N - 0.512) < 0.03, `성비 이상 (남 ${(o.male / N * 100).toFixed(1)}%)`);
check(Object.keys(o.jobs).length >= o.totalJobs * 0.85, '경험되지 않는 직업이 너무 많음');
check(med(o.deaths) >= 76 && med(o.deaths) <= 86, `사망 나이 중앙값 ${med(o.deaths)} (기대 76~86)`);

if (fails.length) { console.log('\n❌ 기준 위반\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\n✅ 모든 기준 통과');
