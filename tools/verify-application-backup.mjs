import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
const directory=resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Provide the private backup directory outside the repository');
for(let ancestor=directory;;ancestor=dirname(ancestor)){
 if(existsSync(join(ancestor,'.git')))throw new Error('Private backup input/output must stay outside Git repositories');
 if(dirname(ancestor)===ancestor)break;
}
const read=name=>{try{return JSON.parse(readFileSync(join(directory,`${name}.json`),'utf8').replace(/^\uFEFF/,''));}catch{throw new Error('Private backup is missing or malformed; contents omitted');}};
const rows=name=>read(name).rows;
const tables=rows('tables'),columns=rows('columns'),constraints=rows('constraints');
const functions=rows('functions'),grants=rows('grants'),policies=rows('policies');
for(const policy of policies){
 if(typeof policy.roles==='string')policy.roles=policy.roles.slice(1,-1).split(',');
 if(!Array.isArray(policy.roles)||policy.roles.some(role=>!/^[A-Za-z_][A-Za-z0-9_]*$/.test(role)))throw new Error('Unsupported policy role array');
 policy.roles=policy.roles.map(role=>role.toUpperCase()==='PUBLIC'?'PUBLIC':role);
}
const data=read('data').rows[0].snapshot;
const q=value=>'"'+String(value).replaceAll('"','""')+'"';
const publicTable=name=>'public.'+q(name);
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const sqlRole=role=>role==='PUBLIC'?'PUBLIC':q(role);
const functionAcl=fn=>(fn.acl===null?[{role:'PUBLIC',grantable:false}]:fn.acl.slice(1,-1).split(',').filter(Boolean).map(entry=>{
 const match=entry.match(/^(.*?)=([^/]*)\//);if(!match)throw new Error('Unsupported function ACL');
 return {role:match[1]||'PUBLIC',grantable:match[2].includes('X*'),execute:match[2].includes('X')};
}));
const roles=new Set(['anon','authenticated','project_admin']);
for(const table of tables)roles.add(table.owner);
for(const g of grants)roles.add(g.role);
for(const p of policies)for(const role of p.roles)roles.add(role);
for(const fn of functions){roles.add(fn.owner);for(const acl of functionAcl(fn))roles.add(acl.role);}
const db=new PGlite();let stage='initialization';
try{
 for(const role of roles)if(role!=='PUBLIC'&&role!=='postgres')await db.exec(`CREATE ROLE ${q(role)}`);
 // Auth service is excluded. This isolated stand-in denies authenticated policy access.
 await db.exec("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';");
 if(rows('sequences').length||columns.some(c=>c.identity||c.generated))throw new Error('This snapshot requires unsupported identity/sequence restoration');
 stage='tables';
 for(const table of tables){
  if(!Array.isArray(data.tables[table.name]))throw new Error('Missing table data');
  const defs=columns.filter(c=>c.table_name===table.name).map(c=>`${q(c.name)} ${c.type}${c.not_null?' NOT NULL':''}`);
  await db.exec(`CREATE TABLE ${publicTable(table.name)}(${defs.join(',')})`);
  await db.exec(`ALTER TABLE ${publicTable(table.name)} OWNER TO ${q(table.owner)}`);
 }
 stage='functions';
 // Exported functions refer to application row types, so tables precede functions.
 for(const fn of functions)await db.exec(fn.sql);
 stage='data';
 for(const table of tables)if(data.tables[table.name].length)await db.query(`INSERT INTO ${publicTable(table.name)} SELECT * FROM jsonb_populate_recordset(NULL::${publicTable(table.name)},$1::jsonb)`,[JSON.stringify(data.tables[table.name])]);
 // Preserve only referenced UUIDs for local FK validation; not real auth credentials.
 for(const con of constraints.filter(c=>c.type==='f'&&/REFERENCES auth\.users/.test(c.definition))){
  const match=con.definition.match(/FOREIGN KEY \((\w+)\)/);if(!match)throw new Error('Unsupported managed foreign key');
  await db.exec(`INSERT INTO auth.users SELECT DISTINCT ${q(match[1])} FROM ${publicTable(con.table_name)} WHERE ${q(match[1])} IS NOT NULL ON CONFLICT DO NOTHING`);
 }
 stage='constraints';
 for(const con of constraints.filter(c=>c.type!=='f'))await db.exec(`ALTER TABLE ${publicTable(con.table_name)} ADD CONSTRAINT ${q(con.name)} ${con.definition}`);
 for(const con of constraints.filter(c=>c.type==='f'))await db.exec(`ALTER TABLE ${publicTable(con.table_name)} ADD CONSTRAINT ${q(con.name)} ${con.definition}`);
 for(const col of columns.filter(c=>c.default_expression))await db.exec(`ALTER TABLE ${publicTable(col.table_name)} ALTER COLUMN ${q(col.name)} SET DEFAULT ${col.default_expression}`);
 stage='indexes and triggers';
 for(const index of rows('indexes'))await db.exec(index.sql);
 for(const trigger of rows('triggers')){
  await db.exec(trigger.sql);
  if(trigger.enabled!=='O')await db.exec(`ALTER TABLE ${publicTable(trigger.table_name)} ${trigger.enabled==='D'?'DISABLE':trigger.enabled==='A'?'ENABLE ALWAYS':'ENABLE REPLICA'} TRIGGER ${q(trigger.name)}`);
 }
 stage='policies and privileges';
 for(const policy of policies){
  await db.exec(`CREATE POLICY ${q(policy.name)} ON ${publicTable(policy.table_name)} AS ${policy.permissive} FOR ${policy.cmd} TO ${policy.roles.map(sqlRole).join(',')}${policy.using_expression?' USING ('+policy.using_expression+')':''}${policy.check_expression?' WITH CHECK ('+policy.check_expression+')':''}`);
 }
 for(const table of tables){
  await db.exec(`REVOKE ALL ON ${publicTable(table.name)} FROM ${[...roles].filter(r=>r!=='postgres').map(sqlRole).join(',')}`);
  for(const g of grants.filter(g=>g.table_name===table.name))await db.exec(`GRANT ${g.privilege} ON ${publicTable(table.name)} TO ${sqlRole(g.role)}${g.is_grantable==='YES'?' WITH GRANT OPTION':''}`);
  if(table.rls)await db.exec(`ALTER TABLE ${publicTable(table.name)} ENABLE ROW LEVEL SECURITY`);
  if(table.force_rls)await db.exec(`ALTER TABLE ${publicTable(table.name)} FORCE ROW LEVEL SECURITY`);
 }
 for(const fn of functions){
  const signature=`public.${q(fn.name)}(${fn.arguments})`;
  await db.exec(`ALTER FUNCTION ${signature} OWNER TO ${q(fn.owner)}; REVOKE ALL ON FUNCTION ${signature} FROM ${[...roles].map(sqlRole).join(',')}`);
  for(const acl of functionAcl(fn))if(acl.execute!==false)await db.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO ${sqlRole(acl.role)}${acl.grantable?' WITH GRANT OPTION':''}`);
 }
 for(const view of rows('views'))await db.exec(`CREATE VIEW ${publicTable(view.name)} AS ${view.definition}`);
 stage='verification constraints and privileges';let total=0;
 const observedConstraints=(await db.query("SELECT count(*)::int AS n FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'" )).rows[0].n;
 const observedTriggers=(await db.query("SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal")).rows[0].n;
 if(observedConstraints!==constraints.length||observedTriggers!==rows('triggers').length)throw new Error('Restored integrity objects differ');
 const observedGrants=(await db.query("SELECT table_name,grantee AS role,privilege_type AS privilege,is_grantable FROM information_schema.table_privileges WHERE table_schema='public'")).rows;
 const aclKey=g=>[g.table_name,g.role,g.privilege,g.is_grantable].join('|');
 if(JSON.stringify(observedGrants.map(aclKey).sort())!==JSON.stringify(grants.map(aclKey).sort()))throw new Error('Restored table permissions differ');
 for(const table of tables){
  stage='verification rows in '+table.name;
  const actual=(await db.query(`SELECT to_jsonb(t) AS value FROM ${publicTable(table.name)} t`)).rows.map(r=>r.value);
  const sortKeys=value=>Array.isArray(value)?value.map(sortKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,sortKeys(item)])):value;
  const canonical=value=>JSON.stringify(sortKeys(value));
  const expected=data.tables[table.name];
  if(JSON.stringify(actual.map(canonical).sort())!==JSON.stringify(expected.map(canonical).sort()))throw new Error('Restored rows differ');
  total+=actual.length;
 }
 const result={verified_at:new Date().toISOString(),data_captured_at:data.captured_at,tables:tables.length,rows:total,constraints:constraints.length,triggers:rows('triggers').length,functions:functions.length,policies:policies.length,table_privileges:grants.length,scope:'Isolated public application restore; auth.users IDs stand-in only, auth credentials and storage excluded'};
 writeFileSync(join(directory,'restore-proof.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){console.error(`Restore failed at ${stage}; SQLSTATE ${error.code||'verification'} (private row details omitted)`);process.exitCode=1;}
finally{await db.close();}
