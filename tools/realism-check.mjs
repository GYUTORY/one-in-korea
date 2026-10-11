// 현실성 검증: index.html의 엔진을 브라우저 없이 N번 돌려 통계를 출력하고 기준을 어기면 exit 1.
// 사용법: node tools/realism-check.mjs [N=5000]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const N = +(process.argv[2] || 5000);
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const MARK = '/* =========================================================\n   UI';
const engine = html.split('<script>')[1].split(MARK)[0]; // DATA + ENGINE 구간만 (UI 제외)

const test = String.raw`
const YEARS=[1960,1975,1990,2000,2010,2026];
const out={relief:0,debtDeath:0,life:{nw60:[],tier:{},m50:{M:0,F:0,nM:0,nF:0},kidsF:[],dM:[],dF:[],own50:0,n50:0},fam:{n:{},home:{},div:0,crash:0,poor:0,imf:0,imfN:0,inh:[],pdead20:0},err:0,deaths:[],start:{},prepStart:{},prepPass:{},prepYears:{},jobs:{},male:0,aiOut:{},wev:0,never:0};
for(let i=0;i<N;i++){try{
  const S=simulate({year:YEARS[i%YEARS.length]});
  const F=S.fam,by=S.birthYear;out.fam.n[by]=(out.fam.n[by]||0)+1;
  if(F.mom.job==='전업주부'||/전업주부/.test(S.log[0].t))out.fam.home[by]=(out.fam.home[by]||0)+1;
  if(F.poor)out.fam.poor++;
  const ih=S.log.find(l=>l.t.includes('상속받았다'));if(ih)out.fam.inh.push(+(ih.t.match(/\+([\d.,]+)(억|만)/)||[0,'0','만'])[1].replace(/,/g,'')*(ih.t.includes('억</')||/\+[\d.]+억/.test(ih.t)?10000:1));
  const L=out.life;if(S.nw60!=null)L.nw60.push(S.nw60);
  const tk=S.edu.univ&&S.edu.univ!=='—'?(S.edu.tier>=5?'SKY·의대':S.edu.tier===4?'인서울·교대·사관':S.edu.tier===3?'지거국·간호':S.edu.tier===2?'지방4년제·예체능':'전문대'):'고졸';
  L.tier[by]=L.tier[by]||{};L.tier[by][tk]=(L.tier[by][tk]||0)+1;
  if(S.age>=50){if(S.gender==='M'){L.m50.nM++;if(S.married||S.marriedAge!=null)L.m50.M++}else{L.m50.nF++;if(S.married||S.marriedAge!=null)L.m50.F++;L.kidsF.push(S.kids)}
    L.n50++;if(S.house)L.own50++}
  if(S.dead&&S.age>=1)(S.gender==='M'?L.dM:L.dF).push(S.age);
  if(S.money+S.houseValue-S.debt<-10000)out.debtDeath++;
  if(S.log.some(l=>l.t.includes('개인회생')))out.relief++;
  out.deaths.push(S.age); if(S.gender==='M')out.male++; if(!S.jobsDone.length)out.never++;
  S.jobsDone.forEach(j=>out.jobs[j]=(out.jobs[j]||0)+1);
  S.log.forEach(l=>{const t=l.t.replace(/<[^>]+>/g,'');let m;
    if(m=t.match(/(.+?)(?:으로|로) 일을 시작했다/)){const n=m[1].replace(/^\S+\s/,'');(out.start[n]=out.start[n]||[]).push(l.a)}

    if(/희망퇴직 서류|해고 통보|자리가 없었다|AI 전환 교육 과정/.test(t))out.aiOut[S.birthYear]=(out.aiOut[S.birthYear]||0)+1;
  });
  (S.preps||[]).forEach(p=>{if(p.start!=null)out.prepStart[p.n]=(out.prepStart[p.n]||0)+1;if(p.ok){out.prepPass[p.n]=(out.prepPass[p.n]||0)+1;(out.prepYears[p.n]=out.prepYears[p.n]||[]).push(p.yrs)}});
  out.wev+=S.history.filter(h=>h.id==='workEvent').length;
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
check(Object.keys(o.start).length>20,'첫 출근 기록을 읽지 못함 — 로그 문구가 바뀌었는지 확인');
console.log('\n[준비 과정] 시작 → 합격률 · 합격자 평균 준비년수');
Object.keys(o.prepStart).filter(k => o.prepStart[k] >= 20).sort((a, b) => o.prepStart[b] - o.prepStart[a]).forEach(k => {
  const y = o.prepYears[k] || [];
  console.log(`  ${k.padEnd(20)} 시작 ${String(o.prepStart[k]).padStart(5)}  합격 ${(100 * (o.prepPass[k] || 0) / o.prepStart[k]).toFixed(0).padStart(3)}%  ${y.length ? (y.reduce((a, b) => a + b, 0) / y.length).toFixed(1) + '년' : '-'}`);
});
const Fm=o.fam;console.log('\n[가족] 출생 시 어머니 전업주부',Object.keys(Fm.n).map(k=>`${k}년생 ${(100*(Fm.home[k]||0)/Fm.n[k]).toFixed(0)}%`).join(' · '));
console.log(`  수급·차상위 출생 ${(100*Fm.poor/N).toFixed(1)}%`);
console.log(`  상속 받은 사람 ${(100*Fm.inh.length/N).toFixed(0)}% (중앙값 ${med(Fm.inh)||0}만)`);
const L=o.life,pct=(a,b)=>(100*a/Math.max(1,b)).toFixed(0)+'%';
console.log('\n[생애] 60세 순자산 중앙값',med(L.nw60),'만 · 50세 자가 보유',pct(L.own50,L.n50),'· 50세까지 결혼 남',pct(L.m50.M,L.m50.nM),'여',pct(L.m50.F,L.m50.nF),'· 여성 평균 자녀',(L.kidsF.reduce((a,b)=>a+b,0)/Math.max(1,L.kidsF.length)).toFixed(2));
console.log('  사망 나이 중앙값 남',med(L.dM),'여',med(L.dF));
for(const by of Object.keys(L.tier)){const t=L.tier[by],n=Object.values(t).reduce((a,b)=>a+b,0);console.log(`  ${by}년생 학력:`,['고졸','전문대','지방4년제·예체능','지거국·간호','인서울·교대·사관','SKY·의대'].map(k=>`${k} ${pct(t[k]||0,n)}`).join(' · '))}
console.log('\n[AI 실직] 출생연도별 1인당', Object.entries(o.aiOut).map(([k, v]) => `${k}: ${(v / (N / 6)).toFixed(2)}`).join(' | '));

console.log(`  개인회생 경험 ${(100*o.relief/N).toFixed(1)}%`);
check(o.relief/N<0.15,`개인회생 경험 ${(100*o.relief/N).toFixed(1)}% — 너무 흔함`);
check(o.debtDeath / N < 0.01, `순자산 −1억 미만으로 생을 마친 사람 ${(100*o.debtDeath/N).toFixed(1)}% (기준 1% 미만)`);
check(o.err === 0, `엔진 오류 ${o.err}건`);
check(Math.abs(o.male / N - 0.512) < 0.03, `성비 이상 (남 ${(o.male / N * 100).toFixed(1)}%)`);
check(Object.keys(o.jobs).length >= o.totalJobs * 0.75, '경험되지 않는 직업이 너무 많음');
check(med(o.deaths) >= 78 && med(o.deaths) <= 88, `사망 나이 중앙값 ${med(o.deaths)} (기대 78~88)`);
check(med(o.life.nw60) < 60000, `60세 순자산 중앙값 ${med(o.life.nw60)}만 — 현실(2~4억대)보다 과다`);
check(med(o.life.dF) - med(o.life.dM) >= 3, '남녀 수명 차이가 너무 작음');
check(L.own50/L.n50>.5&&L.own50/L.n50<.75, `50세 자가 보유 ${pct(L.own50,L.n50)} (기대 50~75%, 2022년 50대 가구 약 65%)`);
check(med(o.life.nw60)>15000, `60세 순자산 중앙값 ${med(o.life.nw60)}만 — 너무 낮음`);

if (fails.length) { console.log('\n❌ 기준 위반\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\n✅ 모든 기준 통과');
