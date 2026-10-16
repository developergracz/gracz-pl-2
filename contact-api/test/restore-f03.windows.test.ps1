param([Parameter(Mandatory=$true)][string]$PgBin)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$scriptFile = Join-Path $repo 'contact-api/operations/Restore-F03.ps1'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($scriptFile,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'POWERSHELL_PARSE_FAILED' }
$root=Join-Path $env:RUNNER_TEMP ('f03 fixture-' + [Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $root
$source=Join-Path $root 'source'
$dump=Join-Path $root 'fixture.dump'
function Pg([string]$Tool,[string[]]$Arguments) {
  Write-Host ('FIXTURE_START: ' + $Tool)
  $prefix=Join-Path $root ([Guid]::NewGuid().ToString('N'))
  $quoted=@($Arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' })
  $p=Start-Process -FilePath (Join-Path $PgBin ($Tool+'.exe')) -ArgumentList ($quoted -join ' ') -RedirectStandardOutput ($prefix+'.out') -RedirectStandardError ($prefix+'.err') -PassThru -NoNewWindow
  $null=$p.Handle
  if (-not $p.WaitForExit(60000)) { $p.Kill(); throw ('FIXTURE_TIMEOUT_' + $Tool) }
  $p.Refresh()
  if ($p.ExitCode -ne 0) { throw ('FIXTURE_' + $Tool + '_FAILED: ' + (Get-Content ($prefix+'.err') -Raw) + (Get-Content ($prefix+'.out') -Raw)) }
  Write-Host ('FIXTURE_DONE: ' + $Tool)
}
function SQL([string]$Text) {
  Pg 'psql' @('-X','-h','127.0.0.1','-p','55433','-U','fixture_owner','-d','fixture','-v','ON_ERROR_STOP=1','-c',$Text)
}
function Check-Restore([bool]$ExpectedPass) {
  $work=Join-Path $root ([Guid]::NewGuid().ToString('N'))
  # Poison inherited settings: production script must ignore these.
  $env:PGHOST='invalid.example'; $env:PGPORT='5432'; $env:PGSERVICE='invalid'
  try {
    Write-Host ('RESTORE_START expectedPass=' + $ExpectedPass)
    $outputFile=Join-Path $root ([Guid]::NewGuid().ToString('N')+'.out')
    $arguments=@('-NoProfile','-NonInteractive','-File',$scriptFile,'-RestoreOnly','-PgBin',$PgBin,'-DumpPath',$dump,'-WorkRoot',$work)
    $quoted=@($arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' })
    $p=Start-Process powershell.exe -ArgumentList ($quoted -join ' ') -RedirectStandardOutput $outputFile -RedirectStandardError ($outputFile+'.err') -PassThru -NoNewWindow
    $null=$p.Handle
    if (-not $p.WaitForExit(120000)) { $p.Kill(); throw ('RESTORE_TIMEOUT: ' + (Get-Content $outputFile -Raw)) }
    $p.Refresh(); $code=$p.ExitCode; $output=@(Get-Content $outputFile)
  } finally { Remove-Item Env:PGHOST,Env:PGPORT,Env:PGSERVICE -ErrorAction SilentlyContinue }
  $files=@(Get-ChildItem -LiteralPath $work -Filter result.json -Recurse)
  if ($files.Count -ne 1) { throw ('RESTORE_REPORT_MISSING: '+($output -join ' ')) }
  $r=Get-Content -LiteralPath $files[0].FullName -Raw | ConvertFrom-Json
  if (($code -eq 0) -ne $ExpectedPass -or ($r.restore -eq 'PASS') -ne $ExpectedPass -or
      -not $r.stopped -or $r.release -ne 'HOLD' -or $r.allowlist -ne 'NOT_CHECKED') {
    throw ('RESTORE_EXPECTATION_FAILED: ' + ($r | ConvertTo-Json -Compress))
  }
  if ($r.localIdentity.fields -ne 5 -or -not $r.localIdentity.directory -or
      -not $r.localIdentity.address -or -not $r.localIdentity.port -or
      -not $r.localIdentity.role -or -not $r.localIdentity.pg18) { throw 'IDENTITY_NOT_VERIFIED' }
  if (-not $ExpectedPass -and ($r.failedStage -ne 'VERIFY_RESTORED_DATA' -or
      $r.failureCode -ne 'PG_PSQL_FAILED')) { throw 'WRONG_REJECTION_REASON' }
  SQL "SELECT 1;" # Independent existing fixture on 55433 must still answer.
  if (Get-ChildItem -LiteralPath $files[0].Directory.FullName -Filter 'local-*') { throw 'PASSWORD_FILE_RETAINED' }
  if (@([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
      Where-Object { $_.Port -eq 55432 }).Count) { throw 'RESTORE_SERVER_NOT_STOPPED' }
}
try {
  Pg 'initdb' @('-D',$source,'--locale=C','--encoding=UTF8','--username=fixture_owner','--auth=trust')
  Pg 'pg_ctl' @('-D',$source,'-l',(Join-Path $root 'fixture.log'),'-o','-h 127.0.0.1 -p 55433','-w','start')
  Pg 'createdb' @('-h','127.0.0.1','-p','55433','-U','fixture_owner','fixture')
  # PostgreSQL inet::text includes /32; host(inet) is the exact address.
  # This reproduces why the previous identity comparison rejected loopback.
  SQL @'
DO $proof$ BEGIN
  IF inet_server_addr()::text <> '127.0.0.1/32'
    OR host(inet_server_addr()) <> '127.0.0.1' THEN
    RAISE EXCEPTION 'INET_REPRESENTATION_REGRESSION';
  END IF;
END $proof$;
'@
  Write-Host 'PASS: inet::text reproduces /32 mismatch; host(inet) preserves exact address'
  SQL 'CREATE TABLE schema_migrations(version text primary key,checksum char(64) not null);'
  $sha=[Security.Cryptography.SHA256]::Create()
  foreach ($name in @('001_persistent_state.sql','002_durable_premium_reply.sql','003_newsletter_state_version.sql','004_contact_data_encryption.sql')) {
    $path=Join-Path $repo ('contact-api/persistence/migrations/'+$name)
    Pg 'psql' @('-X','-h','127.0.0.1','-p','55433','-U','fixture_owner','-d','fixture','-v','ON_ERROR_STOP=1','-f',$path)
    $bytes=[Text.Encoding]::UTF8.GetBytes(([IO.File]::ReadAllText($path)).Replace("`r`n","`n"))
    $hash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
    SQL "INSERT INTO schema_migrations VALUES('$name','$hash');"
  }
  $sha.Dispose()
  SQL @'
INSERT INTO newsletter_contacts(email_hash) VALUES(repeat('1',64)),(repeat('2',64));
INSERT INTO newsletter_consent_events(event_id,email_hash,event_type,source,occurred_at)
SELECT gen_random_uuid(),repeat('1',64),CASE WHEN n=1 THEN 'opt_in_confirmed' ELSE 'opt_in_requested' END,
'synthetic_ci','2026-10-15 19:29:31.474+00'::timestamptz FROM generate_series(1,32) n;
'@
  Pg 'pg_dump' @('-h','127.0.0.1','-p','55433','-U','fixture_owner','-d','fixture','-Fc','-f',$dump)
  Check-Restore $true
  Write-Host 'PASS: full PG18 archive restored; 2/32/1 + registry + stop + secret cleanup'
  SQL "UPDATE schema_migrations SET checksum=repeat('0',64) WHERE version='001_persistent_state.sql';"
  Pg 'pg_dump' @('-h','127.0.0.1','-p','55433','-U','fixture_owner','-d','fixture','-Fc','-f',$dump)
  Check-Restore $false
  Write-Host 'PASS: wrong registry checksum rejected'
  SQL "UPDATE schema_migrations SET checksum='39aac752645ccf4cacd894985112f791cb09b8392c7e29f5d00c10856e6038fb' WHERE version='001_persistent_state.sql'; INSERT INTO newsletter_contacts(email_hash) VALUES(repeat('3',64));"
  Pg 'pg_dump' @('-h','127.0.0.1','-p','55433','-U','fixture_owner','-d','fixture','-Fc','-f',$dump)
  Check-Restore $false
  Write-Host 'PASS: wrong counts rejected'
  $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,55432)
  $listener.Start()
  try {
    $out=@(& powershell.exe -NoProfile -NonInteractive -File $scriptFile -RestoreOnly -PgBin $PgBin -DumpPath $dump -WorkRoot (Join-Path $root 'occupied') 2>&1)
    if ($LASTEXITCODE -eq 0 -or ($out -join ' ') -notmatch 'PORT_55432_OCCUPIED' -or
        (Test-Path -LiteralPath (Join-Path $root 'occupied'))) { throw 'OCCUPIED_PORT_NOT_REJECTED' }
    if (-not $listener.Server.IsBound) { throw 'EXISTING_LISTENER_CHANGED' }
  } finally { $listener.Stop() }
  Write-Host 'PASS: occupied 55432 rejected without touching listener or directory'
  # Exercise real cleanup function with an in-memory HTTP fixture; never call Render.
  foreach ($name in @('Stop-F03','Close-RenderTemp')) {
    $function=$ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true) |
      Where-Object { $_.Name -eq $name }
    Invoke-Expression $function.Extent.Text
  }
  function Get-RenderToken { return 'synthetic-token' }
  $script:calls=@(); $script:remote=@{id='dpg-db38btt9fdbs73aadohg-a';region='frankfurt';databaseName='gracz_r4_staging_postgres';ipAllowList=@(@{cidrBlock='193.106.209.40/32';description='GRACZ F03 TEMP'})}
  function Invoke-RestMethod {
    param($Uri,$Headers,$Method,$MaximumRedirection,$TimeoutSec,$ContentType,$Body)
    if ($Uri -ne 'https://api.render.com/v1/postgres/dpg-db38btt9fdbs73aadohg-a' -or $MaximumRedirection -ne 0) { throw 'HTTP_TARGET_FAILED' }
    $script:calls+= $Method
    if ($Method -eq 'Patch') {
      if ($Body -ne '{"ipAllowList":[]}') { throw 'UNEXPECTED_PATCH' }
      $script:remote.ipAllowList=@()
    }
    return [pscustomobject]$script:remote
  }
  $result=@{allowlist='NOT_CHECKED'}
  Close-RenderTemp
  if (($script:calls -join ',') -ne 'Get,Patch,Get' -or $result.allowlist -ne '[]') { throw 'CLEANUP_FAILED' }
  $script:calls=@(); $script:remote.ipAllowList=@(@{cidrBlock='198.51.100.1/32';description='other'})
  $refused=$false
  try { Close-RenderTemp } catch { $refused=$true }
  if (-not $refused -or ($script:calls -join ',') -ne 'Get') { throw 'UNEXPECTED_RULE_CHANGED' }
  Write-Host 'PASS: exact TEMP removal/readback; unexpected allowlist refused (mock HTTP only)'
} finally {
  $ErrorActionPreference='Continue'
  & (Join-Path $PgBin 'pg_ctl.exe') -D $source -m fast -w stop 2>&1 | Out-Null
}
