// OWNER-only bounded, date-filtered aggregates. No mailbox, identifiers or events.
const SQL=String.raw`
WITH filtered AS MATERIALIZED (
  SELECT (s.requested_at AT TIME ZONE 'Europe/Warsaw')::date AS day,
         s.state,s.confirmed_at,
         (r.email_tag IS NOT NULL) AS revoked
  FROM newsletter_new.subscribers s
  LEFT JOIN newsletter_new.revocations r ON r.email_tag=s.email_tag
  WHERE (s.requested_at AT TIME ZONE 'Europe/Warsaw')::date
        BETWEEN $1::date AND $2::date
    AND ($3::text IS NULL OR s.source=$3)
),
daily AS (
  SELECT day,
    count(*) AS requested,
    count(*) FILTER (WHERE confirmed_at IS NOT NULL) AS confirmed,
    count(*) FILTER (WHERE state='pending' AND NOT revoked) AS pending,
    count(*) FILTER (WHERE revoked) AS withdrawn
  FROM filtered GROUP BY day
)
SELECT days.day::date::text AS day,
       coalesce(daily.requested,0)::text AS requested,
       coalesce(daily.confirmed,0)::text AS confirmed,
       coalesce(daily.pending,0)::text AS pending,
       coalesce(daily.withdrawn,0)::text AS withdrawn
FROM generate_series($1::date,$2::date,interval '1 day') AS days(day)
LEFT JOIN daily ON daily.day=days.day::date
ORDER BY days.day
`;
function parseDay(value){
  if(typeof value!=='string'||!/^(20\d\d)-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value))
    return null;
  const ts=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(ts)&&new Date(ts).toISOString().slice(0,10)===value?ts:null;
}
const count=value=>{
  if(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value))throw Error('invalid_trend');
  const n=Number(value);
  if(!Number.isSafeInteger(n))throw Error('invalid_trend');
  return n;
};
export function createNewOnlyTrendDetail({database}={}){
  if(typeof database?.queryBounded!=='function')throw Error('trend_db_missing');
  return async function readTrendDetail({from,to,source=''}={}){
    const fromTime=parseDay(from),toTime=parseDay(to);
    const days=fromTime!==null&&toTime!==null?1+(toTime-fromTime)/86_400_000:0;
    if(!Number.isInteger(days)||days<1||days>366||
       typeof source!=='string'||(source!==''&&!/^[a-z_]{1,40}$/.test(source)))
      return null;
    const result=await database.queryBounded(SQL,[from,to,source||null],{timeoutMs:4000});
    if(result?.rows?.length!==days)throw Error('trend_unavailable');
    const rows=result.rows.map((r,i)=>{
      const day=new Date(fromTime+i*86_400_000).toISOString().slice(0,10);
      if(r?.day!==day)throw Error('invalid_trend');
      const requested=count(r.requested),confirmed=count(r.confirmed),
        pending=count(r.pending),withdrawn=count(r.withdrawn);
      if(confirmed>requested||pending>requested||withdrawn>requested||
         pending+withdrawn>requested)throw Error('invalid_trend');
      return {day,requested,confirmed,pending,withdrawn,
        doiRate:requested?Math.round(1000*confirmed/requested)/10:null};
    });
    const totals={requested:0,confirmed:0,pending:0,withdrawn:0};
    for(const row of rows)for(const key of Object.keys(totals)){
      totals[key]+=row[key];
      if(!Number.isSafeInteger(totals[key]))throw Error('invalid_trend');
    }
    return {ok:true,scope:'new_only_global',from,to,source:source||null,
      timezone:'Europe/Warsaw',days,totals,rows,
      note:'one_current_record_per_address_latest_request_date'};
  };
}
