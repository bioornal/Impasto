param([string]$BackupRoot = "$env:LOCALAPPDATA\CodexBackups")
$ErrorActionPreference = 'Stop'
if (!(Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { throw 'PowerShell 7.5+ is required to preserve timestamp strings without JSON coercion' }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = [IO.Path]::GetFullPath((Join-Path $BackupRoot ('ecosistema-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))))
if ($destination.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Private backups must be stored outside the repository' }
for($ancestor=$destination; $ancestor; $ancestor=Split-Path $ancestor -Parent) {
 if(Test-Path -LiteralPath (Join-Path $ancestor '.git')) { throw 'Private backups must be stored outside every Git repository' }
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$queries = @{
 tables="SELECT c.relname AS name,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname";
 columns="SELECT c.relname AS table_name,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attidentity AS identity,a.attgenerated AS generated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum";
 constraints="SELECT c.relname AS table_name,p.conname AS name,p.contype AS type,pg_get_constraintdef(p.oid,true) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'";
 indexes="SELECT c.relname AS table_name,pg_get_indexdef(i.indexrelid) AS sql FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conindid=i.indexrelid)";
 triggers="SELECT c.relname AS table_name,t.tgname AS name,pg_get_triggerdef(t.oid,true) AS sql,t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal";
 functions="SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS sql,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')";
 policies="SELECT tablename AS table_name,policyname AS name,permissive,roles,cmd,qual AS using_expression,with_check AS check_expression FROM pg_policies WHERE schemaname='public'";
 grants="SELECT table_name,grantee AS role,privilege_type AS privilege,is_grantable FROM information_schema.table_privileges WHERE table_schema='public'";
 sequences="SELECT * FROM pg_sequences WHERE schemaname='public'";
 views="SELECT viewname AS name,definition FROM pg_views WHERE schemaname='public'"
}
Push-Location $repoRoot
try {
 foreach ($name in $queries.Keys) {
  $raw = npx -y @insforge/cli db query $queries[$name] --json
  if ($LASTEXITCODE -ne 0) { throw "Metadata capture failed: $name" }
  $parsed = ($raw -join "`n") | ConvertFrom-Json -DateKind String
  if ($null -eq $parsed.rows -or $parsed.rowCount -ne $parsed.rows.Count) { throw "Incomplete metadata: $name" }
  $raw | Set-Content (Join-Path $destination "$name.json") -Encoding utf8
 }
 $tables = (Get-Content (Join-Path $destination 'tables.json') -Raw | ConvertFrom-Json -DateKind String).rows
 if (!$tables.Count) { throw 'No application tables found; verify the linked backend' }
 $pairs = @()
 foreach ($table in $tables) {
  $name = $table.name
  if ($name -notmatch '^[a-z_][a-z0-9_]*$') { throw 'Unsupported table identifier' }
  $pairs += "'$name',(SELECT jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb)) FROM public.$name t)"
 }
 # Each UNION branch aggregates a complete table, avoiding PostgreSQL function argument limits.
 $branches = foreach($pair in $pairs) { $separator=$pair.IndexOf(','); "SELECT " + $pair.Substring(0,$separator) + " AS name," + $pair.Substring($separator+1) + " AS value" }
 $query = "SELECT jsonb_build_object('captured_at',now(),'tables',jsonb_object_agg(name,value)) AS snapshot FROM (" + ($branches -join ' UNION ALL ') + ') snapshot_rows'
 $raw = npx -y @insforge/cli db query $query --json
 if ($LASTEXITCODE -ne 0) { throw 'Application data snapshot failed' }
 $data = ($raw -join "`n") | ConvertFrom-Json -DateKind String
 if ($data.rows.Count -ne 1 -or $null -eq $data.rows[0].snapshot.tables) { throw 'Incomplete data snapshot' }
 foreach($table in $tables) {
  $entry = $data.rows[0].snapshot.tables.($table.name)
  if($null -eq $entry -or $entry.count -ne @($entry.rows).Count) { throw 'Truncated table snapshot' }
  $data.rows[0].snapshot.tables.($table.name) = @($entry.rows)
 }
 $data | ConvertTo-Json -Depth 100 | Set-Content (Join-Path $destination 'data.json') -Encoding utf8
 node (Join-Path $PSScriptRoot 'verify-application-backup.mjs') $destination
 if($LASTEXITCODE -ne 0) { throw 'Isolated restoration verification failed' }
 Get-ChildItem $destination -Filter '*.json' | Get-FileHash -Algorithm SHA256 | Select-Object @{n='file';e={Split-Path $_.Path -Leaf}},Hash | ConvertTo-Json | Set-Content (Join-Path $destination 'manifest.json') -Encoding utf8
 Write-Output "Verified private application backup: $destination"
} finally { Pop-Location }
