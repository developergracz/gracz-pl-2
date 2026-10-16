#Requires -Version 5.1
<#
Local PG18 restore only. Default first closes the exact authorized Render TEMP rule.
No production SQL, migration, provider send, secret escrow read, or deploy.
Run from a normal Windows account, not an elevated console. No passwords requested.
The optional Render API token is entered in a masked GUI and held only in memory.
#>
[CmdletBinding()]
param(
  [string]$DumpPath = 'C:\Users\user\GraczDR\gracz_render_20261016_174133.dump',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$WorkRoot = (Join-Path $env:USERPROFILE 'GraczDR'),
  [switch]$RestoreOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$stage = 'PRECHECK'
$runDir = $null
$started = $false
$serverMayExist = $false
$result = [ordered]@{ restore='HOLD'; scope='LOCAL_DUMP_ONLY'; productionMigration='NOT_APPLIED'; release='HOLD'; allowlist='NOT_CHECKED'; stopped=$false }
$savedEnv = @{}
$envPrepared = $false

function Stop-F03([string]$Code) { throw $Code }
function Invoke-Pg([string]$Tool, [string[]]$Arguments) {
  if ($Arguments.Count -eq 1 -and $Arguments[0] -eq '--version') {
    $old = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $output = @(& (Join-Path $PgBin ($Tool + '.exe')) --version 2>&1)
      $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $old }
    if ($exitCode -ne 0) { Stop-F03 'PG_VERSION_FAILED' }
    return (($output | ForEach-Object { $_.ToString() }) -join "`n").Trim()
  }
  # Windows pg_ctl can leave descendant pipe handles open. Use protected files,
  # wait for the actual executable with a deadline, not pipeline EOF.
  if (-not $runDir) { Stop-F03 'PRIVATE_OUTPUT_DIRECTORY_REQUIRED' }
  Write-Host ('F03 ' + $stage + ': ' + $Tool)
  $prefix=Join-Path $runDir ('tool-' + [Guid]::NewGuid().ToString('N'))
  $quoted=@($Arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' })
  try {
    $p=Start-Process -FilePath (Join-Path $PgBin ($Tool+'.exe')) -ArgumentList ($quoted -join ' ') -RedirectStandardOutput ($prefix+'.out') -RedirectStandardError ($prefix+'.err') -PassThru -NoNewWindow
    $null=$p.Handle
    $timeout=60000
    if ($Tool -eq 'pg_restore') { $timeout=300000 }
    if (-not $p.WaitForExit($timeout)) { $p.Kill(); Stop-F03 ('PG_' + $Tool.ToUpperInvariant() + '_TIMEOUT') }
    $p.Refresh()
    if ($p.ExitCode -ne 0) { Stop-F03 ('PG_' + $Tool.ToUpperInvariant() + '_FAILED') }
    return ([IO.File]::ReadAllText($prefix+'.out')).Trim()
  } finally {
    foreach ($suffix in @('.out','.err')) {
      if (Test-Path -LiteralPath ($prefix+$suffix)) { Remove-Item -LiteralPath ($prefix+$suffix) -Force -ErrorAction SilentlyContinue }
    }
  }
}
function Get-RenderToken {
  Add-Type -AssemblyName System.Windows.Forms
  $form = New-Object Windows.Forms.Form
  $form.Text = 'F03: zamkniecie GRACZ F03 TEMP'
  $form.Width = 580; $form.Height = 190; $form.StartPosition = 'CenterScreen'
  $label = New-Object Windows.Forms.Label
  $label.Text = 'Render API key (nie haslo DB). Tylko usuniecie reguly TEMP; bez zapisu klucza.'
  $label.SetBounds(15,15,540,35)
  $inputBox = New-Object Windows.Forms.TextBox
  $inputBox.SetBounds(15,55,530,25); $inputBox.UseSystemPasswordChar = $true
  $ok = New-Object Windows.Forms.Button
  $ok.Text = 'Zamknij dostep'; $ok.SetBounds(340,95,125,30)
  $ok.DialogResult = [Windows.Forms.DialogResult]::OK
  $form.Controls.AddRange(@($label,$inputBox,$ok)); $form.AcceptButton = $ok
  try {
    if ($form.ShowDialog() -ne [Windows.Forms.DialogResult]::OK -or
        [string]::IsNullOrWhiteSpace($inputBox.Text)) { Stop-F03 'RENDER_ACCESS_REQUIRED' }
    return $inputBox.Text
  } finally { $inputBox.Clear(); $form.Dispose() }
}
function Close-RenderTemp {
  $token = $null; $headers = $null
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $token = Get-RenderToken
    $headers = @{ Authorization = 'Bearer ' + $token }
    $uri = 'https://api.render.com/v1/postgres/dpg-db38btt9fdbs73aadohg-a'
    $db = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -MaximumRedirection 0 -TimeoutSec 20
    if ($db.id -ne 'dpg-db38btt9fdbs73aadohg-a' -or $db.region -ne 'frankfurt' -or
        $db.databaseName -ne 'gracz_r4_staging_postgres' -or
        -not ($db.PSObject.Properties.Name -contains 'ipAllowList')) { Stop-F03 'RENDER_IDENTITY_FAILED' }
    if (@($db.ipAllowList).Count -gt 0) {
      if (@($db.ipAllowList).Count -ne 1 -or $db.ipAllowList[0].cidrBlock -ne '193.106.209.40/32' -or
          $db.ipAllowList[0].description -ne 'GRACZ F03 TEMP') { Stop-F03 'UNEXPECTED_ALLOWLIST' }
      $null = Invoke-RestMethod -Uri $uri -Headers $headers -Method Patch -ContentType 'application/json' -Body '{"ipAllowList":[]}' -MaximumRedirection 0 -TimeoutSec 20
    }
    $check = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -MaximumRedirection 0 -TimeoutSec 20
    if ($check.id -ne $db.id -or -not ($check.PSObject.Properties.Name -contains 'ipAllowList') -or
        $null -eq $check.ipAllowList -or @($check.ipAllowList).Count -ne 0) { Stop-F03 'ALLOWLIST_NOT_CONFIRMED' }
    $result.allowlist = '[]'
    Write-Host 'EXTERNAL DB ALLOWLIST: [] (control-plane verified)'
  } finally {
    if ($headers) { $headers.Clear() }
    $token = $null
  }
}
try {
  if ($env:OS -ne 'Windows_NT') { Stop-F03 'WINDOWS_REQUIRED' }
  if (-not $RestoreOnly) { $stage='CLOSE_TEMP_ACCESS'; Close-RenderTemp }
  $stage='LOCAL_PRECHECK'
  foreach ($tool in @('initdb','pg_ctl','psql','createdb','pg_restore')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PgBin ($tool + '.exe')) -PathType Leaf)) { Stop-F03 'PG18_TOOLS_REQUIRED' }
    if ((Invoke-Pg $tool @('--version')) -notmatch 'PostgreSQL\) 18\.') { Stop-F03 'PG18_REQUIRED' }
  }
  $dump = Get-Item -LiteralPath $DumpPath
  if ($dump.PSIsContainer -or $dump.Length -le 0 -or
      ($dump.Attributes -band [IO.FileAttributes]::ReparsePoint)) { Stop-F03 'DUMP_INVALID' }
  $dumpHash = (Get-FileHash -LiteralPath $dump.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  # Port ownership gate: never stop, reuse or connect to an existing server.
  $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
  if (@($listeners | Where-Object { $_.Port -eq 55432 }).Count -gt 0) { Stop-F03 'PORT_55432_OCCUPIED' }
  $root = [IO.Path]::GetFullPath($WorkRoot)
  if ($root.StartsWith('\\') -or $root.Contains("'")) { Stop-F03 'LOCAL_PATH_REQUIRED' }
  if (-not (Test-Path -LiteralPath $root)) { $null = New-Item -ItemType Directory -Path $root }
  $cursor = Get-Item -LiteralPath $root
  while ($null -ne $cursor) {
    if ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) { Stop-F03 'REPARSE_PATH_REJECTED' }
    if (Test-Path -LiteralPath (Join-Path $cursor.FullName '.git')) { Stop-F03 'RESTORE_OUTSIDE_REPO_REQUIRED' }
    $cursor = $cursor.Parent
  }
  $runDir = Join-Path $root ('f03_restore_' + [Guid]::NewGuid().ToString('N'))
  $null = New-Item -ItemType Directory -Path $runDir
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false)
  $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $acl.AddAccessRule($rule); Set-Acl -LiteralPath $runDir -AclObject $acl
  $dataDir = Join-Path $runDir 'data'
  $passwordFile = Join-Path $runDir 'local-init-password'
  $passFile = Join-Path $runDir 'local-pgpass'
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $localPassword = [Convert]::ToBase64String($bytes)
  [IO.File]::WriteAllText($passwordFile,$localPassword,[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($passFile,('127.0.0.1:55432:*:f03_restore_owner:' + $localPassword),[Text.UTF8Encoding]::new($false))
  $localPassword = $null
  # Remove every inherited libpq setting; explicit arguments cannot fall back to prod.
  $envPrepared = $true
  foreach ($item in @(Get-ChildItem Env: | Where-Object { $_.Name -match '^PG' })) {
    $savedEnv[$item.Name] = $item.Value
    [Environment]::SetEnvironmentVariable($item.Name,$null,'Process')
  }
  $env:PGDATA = $dataDir; $env:PGPASSFILE = $passFile; $env:PGCONNECT_TIMEOUT = '5'
  $env:PGCLIENTENCODING = 'UTF8'
  $stage='INITDB'
  $null = Invoke-Pg 'initdb' @('-D',$dataDir,'--username=f03_restore_owner','--encoding=UTF8','--locale=C','--auth=scram-sha-256',('--pwfile=' + $passwordFile))
  Remove-Item -LiteralPath $passwordFile -Force
  if ((Get-Content -LiteralPath (Join-Path $dataDir 'PG_VERSION') -Raw).Trim() -ne '18') { Stop-F03 'CLUSTER_VERSION_FAILED' }
  $config = @"
listen_addresses = '127.0.0.1'
port = 55432
ssl = off
log_statement = 'none'
log_min_error_statement = 'panic'
log_connections = ''
log_disconnections = off
"@
  # ssl=off is ONLY this new loopback disposable cluster, never a production option.
  Add-Content -LiteralPath (Join-Path $dataDir 'postgresql.conf') -Value $config -Encoding ASCII
  $stage='START_LOCAL'
  $serverMayExist=$true
  $null = Invoke-Pg 'pg_ctl' @('-D',$dataDir,'-l',(Join-Path $runDir 'server.log'),'-w','-t','30','start')
  $started=$true
  $connection = @('-h','127.0.0.1','-p','55432','-U','f03_restore_owner','-w')
  $identitySql = "SELECT current_setting('data_directory'),inet_server_addr()::text,inet_server_port(),current_user,current_setting('server_version_num');"
  $identity = Invoke-Pg 'psql' ($connection + @('-X','-A','-t','-F','|','-d','postgres','-v','ON_ERROR_STOP=1','-c',$identitySql))
  $parts = $identity.Split('|')
  if ($parts.Count -ne 5 -or
      [IO.Path]::GetFullPath($parts[0]) -ne [IO.Path]::GetFullPath($dataDir) -or
      $parts[1] -ne '127.0.0.1' -or $parts[2] -ne '55432' -or $parts[3] -ne 'f03_restore_owner' -or
      [int]$parts[4] -lt 180000 -or [int]$parts[4] -ge 190000) { Stop-F03 'LOCAL_IDENTITY_FAILED' }
  $null = Invoke-Pg 'createdb' ($connection + @('--template=template0','f03_restore_check'))
  $stage='RESTORE'
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $null = Invoke-Pg 'pg_restore' ($connection + @('--dbname=f03_restore_check','--no-owner','--no-acl','--no-tablespaces','--no-subscriptions','--exit-on-error','--single-transaction',$dump.FullName))
  $stage='VERIFY_RESTORED_DATA'
  $sql = @'
BEGIN READ ONLY;
DO $verify$
DECLARE registry jsonb;
BEGIN
  IF (SELECT count(*) FROM public.newsletter_contacts) <> 2
    OR (SELECT count(*) FROM public.newsletter_consent_events) <> 32
    OR (SELECT count(*) FROM public.newsletter_consent_events WHERE event_type='opt_in_confirmed') <> 1
    OR (SELECT max(occurred_at) FROM public.newsletter_consent_events) IS DISTINCT FROM timestamptz '2026-10-15 19:29:31.474+00'
    THEN RAISE EXCEPTION 'F03_RESTORE_COUNTS_MISMATCH'; END IF;
  SELECT jsonb_agg(jsonb_build_object('version',version,'checksum',trim(checksum)) ORDER BY version)
    INTO registry FROM public.schema_migrations;
  IF registry IS DISTINCT FROM '[
    {"version":"001_persistent_state.sql","checksum":"39aac752645ccf4cacd894985112f791cb09b8392c7e29f5d00c10856e6038fb"},
    {"version":"002_durable_premium_reply.sql","checksum":"9dfff46f7067e3ee99fd5a04c0089f4751923a827799c5b8cfeff58e2c95a1ff"},
    {"version":"003_newsletter_state_version.sql","checksum":"08ae96740be0d37c7e73c06ed7ba6c64d5d264d149829a577d2d2acb7b6ad5ea"},
    {"version":"004_contact_data_encryption.sql","checksum":"4ff581bfb8d67984b8b3eca76e64569c7f14635c3c0c3f7581bdea749987cdd8"}
  ]'::jsonb THEN RAISE EXCEPTION 'F03_RESTORE_REGISTRY_MISMATCH'; END IF;
  IF to_regclass('public.newsletter_schema_migrations') IS NOT NULL
    OR to_regclass('public.newsletter_opt_in_requests') IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.idempotency_keys WHERE scope='newsletter-cutover')
    THEN RAISE EXCEPTION 'F03_RESTORE_UNEXPECTED_CUTOVER'; END IF;
END $verify$;
ROLLBACK;
'@
  $sqlFile = Join-Path $runDir 'verify.sql'
  [IO.File]::WriteAllText($sqlFile,$sql,[Text.UTF8Encoding]::new($false))
  $null = Invoke-Pg 'psql' ($connection + @('-X','-q','-d','f03_restore_check','-v','ON_ERROR_STOP=1','-f',$sqlFile))
  $watch.Stop()
  if ((Get-FileHash -LiteralPath $dump.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $dumpHash) { Stop-F03 'DUMP_CHANGED' }
  $result.restore='PASS'; $result.dumpSha256=$dumpHash; $result.dumpBytes=$dump.Length
  $result.contacts=2; $result.events=32; $result.confirmedEvents=1; $result.registryMatches=4
  $result.restoreSeconds=[math]::Round($watch.Elapsed.TotalSeconds,2)
  $result.escrow='NOT_VERIFIED'; $result.decrypt='NOT_VERIFIED'; $result.offsiteRecovery='NOT_VERIFIED'
} catch {
  $result.restore='HOLD'
  $result.failedStage=$stage
  if ($_.Exception.Message -match '^[A-Z0-9_]+$') { $result.failureCode=$_.Exception.Message }
  # Never print the exception or native output: these may include data or credentials.
} finally {
  if ($serverMayExist) {
    try {
      $null = Invoke-Pg 'pg_ctl' @('-D',$dataDir,'-m','fast','-w','-t','30','stop')
      $result.stopped=$true
    } catch {
      $result.restore='HOLD'; $result.failedStage='LOCAL_STOP_NOT_CONFIRMED'
    }
  }
  if ($envPrepared) {
    foreach ($name in @('PGDATA','PGPASSFILE','PGCONNECT_TIMEOUT','PGCLIENTENCODING')) {
      [Environment]::SetEnvironmentVariable($name,$null,'Process')
    }
    foreach ($name in $savedEnv.Keys) { [Environment]::SetEnvironmentVariable($name,$savedEnv[$name],'Process') }
  }
  if ($runDir) {
    foreach ($name in @('local-init-password','local-pgpass')) {
      $file=Join-Path $runDir $name
      if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
    }
    $result.completedAt=[DateTime]::UtcNow.ToString('o')
    $result.scriptSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runDir 'result.json') -Encoding UTF8
  }
}
$result | ConvertTo-Json -Depth 4
if ($runDir) { Write-Host ('Private result: ' + (Join-Path $runDir 'result.json')) }
if ($result.restore -ne 'PASS') { exit 1 }
