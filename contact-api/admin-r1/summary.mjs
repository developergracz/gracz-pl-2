// OWNER-only M4: global aggregates of the isolated new-only consent ledger.
// No addresses, tokens, IPs, legacy data, provider claims, or write queries.
const SQL = `
WITH clock AS (SELECT clock_timestamp() AS at),
snap AS (
  SELECT at, (at AT TIME ZONE 'Europe/Warsaw')::date AS day
  FROM clock
),
facts AS MATERIALIZED (
  SELECT s.state, s.confirmed_at, s.source,
         (s.requested_at AT TIME ZONE 'Europe/Warsaw')::date AS day,
         (r.email_tag IS NOT NULL) AS revoked
  FROM newsletter_new.subscribers s
  LEFT JOIN newsletter_new.revocations r ON r.email_tag=s.email_tag
),
totals AS (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE f.state='active' AND NOT f.revoked) AS active,
         count(*) FILTER (WHERE f.state='pending' AND NOT f.revoked) AS pending,
         count(*) FILTER (WHERE f.revoked) AS withdrawn,
         count(*) FILTER (WHERE f.day=snap.day) AS today,
         count(*) FILTER (WHERE f.day BETWEEN snap.day-6 AND snap.day) AS last7,
         count(*) FILTER (WHERE f.day BETWEEN snap.day-29 AND snap.day) AS last30,
         count(*) FILTER (
           WHERE f.day BETWEEN snap.day-29 AND snap.day
             AND f.confirmed_at IS NOT NULL
         ) AS confirmed30
  FROM facts f CROSS JOIN snap
),
daily AS (
  SELECT f.day,
         count(*) AS requested,
         count(*) FILTER (WHERE f.confirmed_at IS NOT NULL) AS confirmed
  FROM facts f CROSS JOIN snap
  WHERE f.day BETWEEN snap.day-29 AND snap.day
  GROUP BY f.day
),
sources AS (
  SELECT f.source, count(*) AS total
  FROM facts f CROSS JOIN snap
  WHERE f.day BETWEEN snap.day-29 AND snap.day
  GROUP BY f.source
  ORDER BY total DESC, f.source
  LIMIT 8
)
SELECT snap.at AS fetched_at,
       totals.total::text AS total, totals.active::text AS active,
       totals.pending::text AS pending, totals.withdrawn::text AS withdrawn,
       totals.today::text AS today, totals.last7::text AS last7,
       totals.last30::text AS last30,
       totals.confirmed30::text AS confirmed30,
       (SELECT jsonb_agg(jsonb_build_object(
           'day', days.day::text,
           'requested', coalesce(daily.requested,0),
           'confirmed', coalesce(daily.confirmed,0)
         ) ORDER BY days.day)
        FROM (SELECT (snap.day - n)::date AS day FROM generate_series(0,29) n) days
        LEFT JOIN daily ON daily.day=days.day) AS trend,
       (SELECT coalesce(jsonb_agg(jsonb_build_object(
           'source',sources.source,'count',sources.total)
           ORDER BY sources.total DESC,sources.source),'[]'::jsonb)
        FROM sources) AS sources
FROM snap CROSS JOIN totals
`;
const safeCount = value => {
  if(typeof value!=='string'|| !/^(0|[1-9][0-9]*)$/.test(value))throw Error('invalid_summary');
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw Error('invalid_summary');
  return n;
};
const safeJsonCount = value => {
  if(!Number.isSafeInteger(value)||value<0)throw Error('invalid_summary');
  return value;
};
export function createNewOnlySummary({database}={}){
  if(typeof database?.queryBounded!=='function')throw Error('summary_db_missing');
  return async function readSummary(){
    // One bounded, read-only PostgreSQL snapshot. A timeout never becomes zero.
    const response=await database.queryBounded(SQL,[],{timeoutMs:4000});
    if(response?.rows?.length!==1)throw Error('summary_unavailable');
    const row=response.rows[0];
    const counts=Object.fromEntries(
      ['total','active','pending','withdrawn','today','last7','last30','confirmed30']
        .map(name=>[name,safeCount(row[name])])
    );
    if(counts.active+counts.pending+counts.withdrawn!==counts.total||
      counts.confirmed30>counts.last30||counts.last30>counts.total||
      counts.last7>counts.last30||counts.today>counts.last7)
      throw Error('invalid_summary');
    const trend=row.trend;
    if(!Array.isArray(trend)||trend.length!==30)throw Error('invalid_summary');
    let requestedSum=0,confirmedSum=0,previous='';
    const daily=trend.map(entry=>{
      if(!entry||typeof entry.day!=='string'||
         !/^\\d{4}-\\d{2}-\\d{2}$/.test(entry.day)||entry.day<=previous)
        throw Error('invalid_summary');
      previous=entry.day;
      const requested=safeJsonCount(entry.requested),
            confirmed=safeJsonCount(entry.confirmed);
      if(confirmed>requested)throw Error('invalid_summary');
      requestedSum+=requested;confirmedSum+=confirmed;
      return {day:entry.day,requested,confirmed};
    });
    if(requestedSum!==counts.last30||confirmedSum!==counts.confirmed30)
      throw Error('invalid_summary');
    if(!Array.isArray(row.sources)||row.sources.length>8)throw Error('invalid_summary');
    const sources=row.sources.map(entry=>{
      if(!entry||typeof entry.source!=='string'||
         !/^[a-z_]{1,40}$/.test(entry.source))throw Error('invalid_summary');
      return {source:entry.source,count:safeJsonCount(entry.count)};
    });
    if(sources.reduce((sum,item)=>sum+item.count,0)>counts.last30)
      throw Error('invalid_summary');
    const fetched=new Date(row.fetched_at);
    if(!Number.isFinite(fetched.getTime()))throw Error('invalid_summary');
    return {
      ok:true,scope:'new_only_global',fetchedAt:fetched.toISOString(),
      counts,
      doiRate30:counts.last30?
        Math.round(1000*counts.confirmed30/counts.last30)/10:null,
      trend:daily,sources,sourceScope:'top_8',
      quality:['new_only_only','one_current_record_per_address',
               'latest_request_date_not_all_attempts','doi_not_provider_delivery']
    };
  };
}
