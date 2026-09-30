import {decideCardAttempt,type PersistedCardAttempt} from './card-attempt';
export async function recoverMatchingCardAttempt<T extends PersistedCardAttempt>(existing:T,request:Parameters<typeof decideCardAttempt>[1],lookup:(existing:T)=>Promise<T>) {
  let decision=decideCardAttempt(existing,request);
  if(decision==='conflict') return {decision,existing:null};
  if(decision==='wait-pending') {
    try { existing=await lookup(existing);decision=decideCardAttempt(existing,request); }
    catch { /* A lookup failure retains the same pending attempt. */ }
  }
  return {decision,existing};
}
