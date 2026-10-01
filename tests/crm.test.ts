import assert from 'node:assert/strict';
import {test} from 'node:test';
import {leerClientesCrm,guardarPerfilCliente,mismoTelefono} from '../lib/crm';
const row={telefono:'12345678',cant_compras:2,total_cobrado:300,compras_sin_importe:0,ultima_compra:null};
test('complete CRM continues short capped pages, failure never becomes zero',async()=>{
 const offsets:number[]=[];
 const rows=await leerClientesCrm(async(_,args)=>{offsets.push(Number(args.p_offset));return {data:args.p_offset===0?[row]:[],error:null};});
 assert.deepEqual(offsets,[0,1]);assert.equal(rows[0].cant_compras,2);
 await assert.rejects(leerClientesCrm(async()=>({data:[row,{...row,telefono:'(123) 45678'}],error:null})),/duplicad/);
 await assert.rejects(leerClientesCrm(async(_,args)=>args.p_offset?{data:null,error:'offline'}:{data:[row],error:null}));
 await assert.rejects(leerClientesCrm(async()=>({data:[row],error:null})),/duplicad/);
 await assert.rejects(leerClientesCrm(async()=>({data:[{...row,cant_compras:undefined}],error:null})));
});
test('profile confirmation and authoritative read required; saving never sends counters',async()=>{
 const names:string[]=[];
 const saved=await guardarPerfilCliente(async(name,args)=>{names.push(name);if(name==='guardar_perfil_cliente'){assert.deepEqual(args.p_perfil,{telefono:row.telefono,nombre:'Ana'});return {data:{telefono:row.telefono,cant_compras:999},error:null};}return {data:args.p_offset===0?[row]:[],error:null};},{telefono:row.telefono,nombre:'Ana'});
 assert.equal(saved.cant_compras,2);assert.equal(names[0],'guardar_perfil_cliente');
 await assert.rejects(guardarPerfilCliente(async()=>({data:null,error:'offline'}),{telefono:row.telefono}));
});
test('identity is full phone digits, never names or matching suffixes',()=>{
 assert.equal(mismoTelefono('+54 (9) 12345678','54912345678'),true);
 assert.equal(mismoTelefono('54912345678','9912345678'),false);
 assert.equal(mismoTelefono('Ana','Ana'),false);
});
