import { BasicSession, type Host } from './src/renderer/src/basic/index'
import { SAMPLES } from './src/renderer/src/samples'
async function runOne(name: string, code: string, inputs: string[]) {
  let out = ''
  const queue = [...inputs]
  const host: Host = { output: (t)=>out+=t, inputLine: async()=>queue.shift()??'0', clearScreen: ()=>out='' }
  const s = new BasicSession(host)
  s.setProgramText(code)
  await s.execute('RUN')
  const errs = out.split('\n').filter((l)=>l.startsWith('?'))
  console.log(`${errs.length? 'ERR ':'OK  '} ${name}${errs.length? '  -> '+errs.join(' | '):''}`)
}
async function main(){
  for (const s of SAMPLES){
    const inputs = s.name==='MATH'?['12','4']:s.name==='GUESS'?['50','25','12','6','3','1','2']:[]
    await runOne(s.name, s.code, inputs)
  }
}
await main()
