import assert from 'node:assert/strict';
import { readPages } from '../lib/read-pages';
async function main(){
const rows=Array.from({length:1203},(_,id)=>({id:String(id)}));
const offsets:number[]=[];
const all=await readPages(async(start,end)=>{offsets.push(start);return {data:rows.slice(start,Math.min(start+73,end+1)),error:null};});
assert.deepEqual(all.data,rows);assert.equal(offsets.at(-1),rows.length);
for(const mode of ['duplicate','error','null','throw']){
 const result=await readPages(async(start)=>{if(!start)return {data:[{id:'a'}],error:null};if(mode==='throw')throw Error('network');return {data:mode==='null'?null:[{id:'a'}],error:mode==='error'?Error('backend'):null};});
 assert.equal(result.data,null);assert.ok(result.error);
}
assert.ok((await readPages(async()=>({data:[],error:null}),0)).error);
console.log('read-pages: capped pages, duplicates, failed later pages and invalid size verified');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
