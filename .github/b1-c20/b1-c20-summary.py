#!/usr/bin/env python3
import csv
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPORT_DIR = Path(os.environ.get("B1_C20_REPORT_DIR", "perf/k6/reports"))
RUN_ID = os.environ.get("WAVE_B_RUN_ID", "b1-c20-r1-v100")
AUTHORIZED_BRANCH = "fix/wave-b-b1-c19-lobby-state-single-acquisition"
AUTHORIZED_HEAD = "9413b0ebd6c0507b6f4987d8fc589771ce29e612"
AUTHORIZED_TREE = "2f9cf937be8ac8a8d7f237fe03984d93c62a373f"
REFERENCE = {
    "runId": 34461410851,
    "artifactId": 10146040534,
    "sharedStorePool": {
        "acquisitionsPerSecond": 226.68,
        "acquireP95Ms": 359.0,
        "acquireP99Ms": 446.0,
        "historicalWaitingMax": 110,
    },
    "latency": {
        "fast": {"p95Ms": 975.1758016999992, "p99Ms": 1099.76938118},
        "normal": {"p95Ms": 1048.29616995, "p99Ms": 1133.4562474},
        "complex": {"p95Ms": 324.265695, "p99Ms": 410.66956920999905},
    },
    "expectedStaticPostC19AcquisitionsPerSecond": 139.67,
    "expectedReductionPerSecond": 86.91,
}


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def maybe_json(path):
    try:
        return load_json(path)
    except Exception:
        return None


def parse_iso(value):
    if not value:
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000


def percentile(values, q):
    values = sorted(float(v) for v in values if v is not None and math.isfinite(float(v)))
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    pos = (len(values) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return values[lo]
    return values[lo] + (values[hi] - values[lo]) * (pos - lo)


def stats(values, include_min=False):
    vals = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    if not vals:
        return {"count": 0, "mean": None, "p95": None, "p99": None, "max": None, **({"min": None} if include_min else {})}
    out = {
        "count": len(vals),
        "mean": sum(vals) / len(vals),
        "p95": percentile(vals, 0.95),
        "p99": percentile(vals, 0.99),
        "max": max(vals),
    }
    if include_min:
        out["min"] = min(vals)
    return out


def metric(summary, name):
    return (summary.get("metrics") or {}).get(name) or {}


def metric_count(summary, name):
    return int(round(float((metric(summary, name).get("values") or {}).get("count", 0) or 0)))


def rate_true_count(summary, name):
    vals = metric(summary, name).get("values") or {}
    return int(round(float(vals.get("passes", 0) or 0)))


def trend(summary, name):
    m = metric(summary, name)
    vals = m.get("values") or {}
    thresholds = m.get("thresholds") or {}
    return {
        "p95Ms": vals.get("p(95)"),
        "p99Ms": vals.get("p(99)"),
        "maxMs": vals.get("max"),
        "avgMs": vals.get("avg"),
        "thresholds": thresholds,
        "pass": bool(thresholds) and all(bool(v.get("ok")) for v in thresholds.values()),
    }


def csv_rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def filter_window(rows, start_ms, end_ms):
    out = []
    for row in rows:
        ts = parse_iso(row.get("ts"))
        if ts is not None and start_ms <= ts < end_ms:
            out.append(row)
    return out


def f(row, key):
    try:
        text = str(row.get(key, "")).strip().rstrip("%")
        return float(text) if text else None
    except Exception:
        return None


def delta(rows, key):
    vals = [f(r, key) for r in rows]
    vals = [v for v in vals if v is not None]
    return vals[-1] - vals[0] if len(vals) >= 2 else None


def mb(bytes_value):
    return bytes_value / 1024 / 1024 if bytes_value is not None else None


def pool_by_label(telemetry, exact=None, prefix=None, max_value=None):
    for pool in telemetry.get("pools", []):
        label = pool.get("label", "")
        if exact is not None and label == exact:
            return pool
        if prefix is not None and label.startswith(prefix) and (max_value is None or pool.get("configuredMax") == max_value):
            return pool
    return None


def attr(pool, source):
    if not pool:
        return None
    for item in pool.get("attribution", []):
        if item.get("source") == source:
            return item
    return None


def with_rates(pool, steady_seconds, historical_max=None):
    if not pool:
        return None
    out = dict(pool)
    out["acquisitionsPerSecond"] = (pool.get("acquire", {}).get("count", 0) or 0) / steady_seconds
    out["queriesPerSecond"] = (pool.get("query", {}).get("count", 0) or 0) / steady_seconds
    if historical_max is not None:
        out["historicalMaxWaitingCount"] = max(int(out.get("historicalMaxWaitingCount") or 0), int(historical_max))
    for item in out.get("attribution", []):
        item["acquisitionsPerSecond"] = (item.get("acquire", {}).get("count", 0) or 0) / steady_seconds
        item["queriesPerSecond"] = (item.get("query", {}).get("count", 0) or 0) / steady_seconds
    return out


def main():
    summary_path = REPORT_DIR / f"{RUN_ID}-summary.json"
    if not summary_path.exists():
        summary_path = REPORT_DIR / f"{RUN_ID}-k6-summary-export.json"
    k6 = load_json(summary_path)
    correctness = load_json(REPORT_DIR / f"{RUN_ID}-correctness.json")
    record = load_json(REPORT_DIR / f"{RUN_ID}-record.json")
    window = load_json(REPORT_DIR / f"{RUN_ID}-b1-c20-k6-window.json")
    telemetry = load_json(REPORT_DIR / f"{RUN_ID}-b1-c20-steady-telemetry.json")
    start_ms = int(window["steadyStartEpochMs"])
    end_ms = int(window["steadyEndEpochMs"])
    steady_seconds = float(window["steadySeconds"])

    obs_path = REPORT_DIR / f"{RUN_ID}-observability-0.jsonl"
    obs = []
    if obs_path.exists():
        for line in obs_path.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
            except Exception:
                continue
            ts = parse_iso(row.get("ts"))
            if ts is not None and start_ms <= ts < end_ms:
                obs.append(row)

    historical_pool_wait = {}
    if obs_path.exists():
        for line in obs_path.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
            except Exception:
                continue
            for pool in row.get("pools", []):
                label = pool.get("label")
                historical_pool_wait[label] = max(historical_pool_wait.get(label, 0), int(pool.get("maxWaitingCount") or 0))

    app_rows = filter_window(csv_rows(REPORT_DIR / f"{RUN_ID}-application.csv"), start_ms, end_ms)
    pg_rows = filter_window(csv_rows(REPORT_DIR / f"{RUN_ID}-postgres.csv"), start_ms, end_ms)
    host_rows = filter_window(csv_rows(REPORT_DIR / f"{RUN_ID}-host.csv"), start_ms, end_ms)

    shared_raw = pool_by_label(telemetry, prefix="postgres-session-store.js", max_value=4)
    traffic_raw = pool_by_label(telemetry, prefix="distributed-infrastructure.js", max_value=4)
    shared = with_rates(shared_raw, steady_seconds, historical_pool_wait.get(shared_raw.get("label") if shared_raw else ""))
    traffic = with_rates(traffic_raw, steady_seconds, historical_pool_wait.get(traffic_raw.get("label") if traffic_raw else ""))

    other_pools = []
    for raw in telemetry.get("pools", []):
        if raw is shared_raw or raw is traffic_raw:
            continue
        other_pools.append(with_rates(raw, steady_seconds, historical_pool_wait.get(raw.get("label", ""))))
    other_pools.sort(key=lambda p: -(p.get("acquisitionsPerSecond") or 0))

    fast = trend(k6, "wave_b_fast_read_ms")
    normal = trend(k6, "wave_b_normal_command_ms")
    complex_ = trend(k6, "wave_b_complex_read_ms")
    k6_slo_pass = fast["pass"] and normal["pass"] and complex_["pass"]

    http_info = telemetry.get("http", {})
    error_codes = http_info.get("errorCodes", {})
    timeouts = rate_true_count(k6, "wave_b_timeout")
    unexpected = rate_true_count(k6, "wave_b_unexpected_error")
    k6_5xx = rate_true_count(k6, "wave_b_server_5xx")
    shared_unavailable = int(error_codes.get("SHARED_INFRASTRUCTURE_UNAVAILABLE", 0) or 0)
    traffic_denials = int(error_codes.get("TOO_MANY_REQUESTS", 0) or 0)
    chat_rate = int(error_codes.get("CHAT_RATE_LIMIT", 0) or 0)
    chat_duplicate = int(error_codes.get("CHAT_DUPLICATE", 0) or 0)

    cpu = stats([f(r, "cpu_percent") for r in app_rows])
    rss = stats([f(r, "rss_kb") / 1024 if f(r, "rss_kb") is not None else None for r in app_rows])
    heap_used = stats([mb(float(r.get("heapUsed"))) for r in obs if r.get("heapUsed") is not None])
    heap_total = stats([mb(float(r.get("heapTotal"))) for r in obs if r.get("heapTotal") is not None])
    event_loop_p99 = stats([r.get("eventLoopP99Ms") for r in obs])
    event_loop_max = stats([r.get("eventLoopMaxMs") for r in obs])
    active_requests = stats([r.get("activeRequests") for r in obs])
    active_handles = stats([r.get("activeHandles") for r in obs])

    pg_cpu = stats([f(r, "postgres_cpu_percent") for r in host_rows])
    postgres = {
        "samples": len(pg_rows),
        "cpuPercent": pg_cpu,
        "maxConnections": max([f(r, "max_connections") or 0 for r in pg_rows], default=None),
        "numbackends": stats([f(r, "numbackends") for r in pg_rows]),
        "activeQueries": stats([f(r, "active") for r in pg_rows]),
        "idleConnections": stats([f(r, "idle") for r in pg_rows], include_min=True),
        "waitEventConnections": stats([f(r, "waiting") for r in pg_rows]),
        "clientWaitConnections": stats([f(r, "client_wait") for r in pg_rows]),
        "lockWaitConnections": stats([f(r, "lock_wait") for r in pg_rows]),
        "lwlockWaitConnections": stats([f(r, "lwlock_wait") for r in pg_rows]),
        "transactionIdWaitConnections": stats([f(r, "transactionid_wait") for r in pg_rows]),
        "longQueries": stats([f(r, "long_queries") for r in pg_rows]),
        "maxQueryMs": stats([f(r, "max_query_ms") for r in pg_rows]),
        "maxTransactionMs": stats([f(r, "max_xact_ms") for r in pg_rows]),
        "deadlocksDelta": delta(pg_rows, "deadlocks"),
        "tempFilesDelta": delta(pg_rows, "temp_files"),
        "tempBytesDelta": delta(pg_rows, "temp_bytes"),
        "commitsDelta": delta(pg_rows, "xact_commit"),
        "rollbacksDelta": delta(pg_rows, "xact_rollback"),
    }

    lobby_path = (http_info.get("paths") or {}).get("GET /lobby/state", {})
    shared_lobby_attr = attr(shared, "lobby.js") if shared else None
    shared_chat_attr = attr(shared, "distributed-global-chat.js") if shared else None

    reference_rate = REFERENCE["sharedStorePool"]["acquisitionsPerSecond"]
    new_rate = shared.get("acquisitionsPerSecond") if shared else None
    if new_rate is not None:
        absolute_change = new_rate - reference_rate
        reduction = reference_rate - new_rate
        percent_change = (absolute_change / reference_rate) * 100
        realized_vs_expected = reduction / REFERENCE["expectedReductionPerSecond"] if REFERENCE["expectedReductionPerSecond"] else None
    else:
        absolute_change = reduction = percent_change = realized_vs_expected = None

    control_exit_path = REPORT_DIR / "b1-c20-control-exit.txt"
    try:
        control_exit = int(control_exit_path.read_text(encoding="utf-8").strip())
    except Exception:
        control_exit = None

    expected_duration = (window["warmupSeconds"] + window["steadySeconds"] + window["cooldownSeconds"]) * 1000
    actual_duration = window.get("actualDurationMs")
    workload_completed = bool(window.get("k6EndEpochMs")) and actual_duration is not None and actual_duration >= expected_duration - 2000

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "identity": {
            "authorizedBranch": AUTHORIZED_BRANCH,
            "authorizedHead": AUTHORIZED_HEAD,
            "authorizedTree": AUTHORIZED_TREE,
            "controlHead": record.get("head"),
            "controlTree": record.get("tree"),
            "runId": RUN_ID,
        },
        "profile": {
            "replicas": record.get("replicas"),
            "vus": record.get("vus"),
            "scenario": record.get("scenario"),
            "seededGames": 50,
            "warmupSeconds": record.get("warmupSeconds"),
            "steadySeconds": record.get("steadySeconds"),
            "cooldownSeconds": record.get("cooldownSeconds"),
            "thinkSeconds": 0.05,
        },
        "window": window,
        "workload": {
            "completed": workload_completed,
            "controlExit": control_exit,
            "k6Exit": record.get("k6Exit"),
            "probeExit": record.get("probeExit"),
            "correctnessExit": record.get("correctnessExit"),
            "pgSamplerExit": record.get("pgSamplerExit"),
            "appSamplerExit": record.get("appSamplerExit"),
            "hostSamplerExit": record.get("hostSamplerExit"),
        },
        "correctness": correctness,
        "errors": {
            "steadyHttpRequests": int(http_info.get("total", 0) or 0),
            "status2xx": int(http_info.get("status2xx", 0) or 0),
            "status3xx": int(http_info.get("status3xx", 0) or 0),
            "status409": int(http_info.get("status409", 0) or 0),
            "status429": int(http_info.get("status429", 0) or 0),
            "status5xx": int(http_info.get("status5xx", 0) or 0),
            "other4xx": int(http_info.get("other4xx", 0) or 0),
            "k6Server5xx": k6_5xx,
            "timeouts": timeouts,
            "unexpectedErrors": unexpected,
            "sharedInfrastructureUnavailable": shared_unavailable,
            "trafficGuardDenials": traffic_denials,
            "globalChatRateLimit": chat_rate,
            "globalChatDuplicate": chat_duplicate,
            "errorCodes": error_codes,
            "k6Expected409Counter": metric_count(k6, "wave_b_expected_409"),
            "k6Expected429Counter": metric_count(k6, "wave_b_expected_429"),
        },
        "latency": {"fast": fast, "normal": normal, "complex": complex_, "allClassesPass": k6_slo_pass},
        "pools": {
            "sharedStore": shared,
            "trafficGuard": traffic,
            "other": other_pools,
        },
        "lobby": {
            "stateRequests": int(lobby_path.get("total", 0) or 0),
            "stateRequestsPerSecond": (int(lobby_path.get("total", 0) or 0) / steady_seconds),
            "stateStatus": lobby_path,
            "sharedPoolAttribution": shared_lobby_attr,
        },
        "globalChat": {
            "sharedPoolAttribution": shared_chat_attr,
            "listeners": telemetry.get("globalChatListeners", []),
        },
        "node": {
            "cpuPercent": cpu,
            "rssMB": rss,
            "heapUsedMB": heap_used,
            "heapTotalMB": heap_total,
            "eventLoopP99Ms": event_loop_p99,
            "eventLoopMaxMs": event_loop_max,
            "activeRequests": active_requests,
            "activeHandles": active_handles,
        },
        "postgres": postgres,
        "reference": REFERENCE,
        "c19Effect": {
            "referenceAcquisitionsPerSecond": reference_rate,
            "observedAcquisitionsPerSecond": new_rate,
            "absoluteChangePerSecond": absolute_change,
            "observedReductionPerSecond": reduction,
            "percentChange": percent_change,
            "expectedReductionPerSecond": REFERENCE["expectedReductionPerSecond"],
            "expectedStaticPostC19PerSecond": REFERENCE["expectedStaticPostC19AcquisitionsPerSecond"],
            "realizedReductionVsExpectedRatio": realized_vs_expected,
        },
    }

    output = REPORT_DIR / "B1-C20-EVIDENCE.json"
    output.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    md = []
    md.append("# B1-C20 Post-C19 Single 100 VU Verification Control")
    md.append("")
    md.append(f"Run ID: `{RUN_ID}`")
    md.append(f"Authorized source: `{AUTHORIZED_HEAD}` / `{AUTHORIZED_TREE}`")
    md.append(f"Control HEAD/TREE: `{record.get('head')}` / `{record.get('tree')}`")
    md.append(f"Steady window: `{window.get('steadyStartIso')}` → `{window.get('steadyEndIso')}`")
    md.append("")
    md.append("## Frozen profile")
    md.append("")
    md.append("1 replica; 100 VUs; mixed-platform; 50 games; 120s warmup; 300s steady; 120s cooldown; think 0.05s.")
    md.append("")
    md.append("## Correctness")
    md.append("")
    md.append(f"PASS: `{bool(correctness.get('pass'))}`")
    md.append("")
    md.append("## Latency")
    md.append("")
    md.append(f"FAST p95={fast.get('p95Ms')} p99={fast.get('p99Ms')} pass={fast.get('pass')}")
    md.append(f"NORMAL p95={normal.get('p95Ms')} p99={normal.get('p99Ms')} pass={normal.get('pass')}")
    md.append(f"COMPLEX p95={complex_.get('p95Ms')} p99={complex_.get('p99Ms')} pass={complex_.get('pass')}")
    md.append("")
    md.append("## Shared store.pool")
    md.append("")
    if shared:
        md.append(f"Acquisitions={shared['acquire']['count']} rate={shared['acquisitionsPerSecond']:.3f}/s acquire p95={shared['acquire']['p95Ms']}ms p99={shared['acquire']['p99Ms']}ms maxWaiting={shared.get('maxWaitingCount')} historicalMaxWaiting={shared.get('historicalMaxWaitingCount')}")
        md.append(f"Queries={shared['query']['count']} rate={shared['queriesPerSecond']:.3f}/s query p95={shared['query']['p95Ms']}ms p99={shared['query']['p99Ms']}ms")
    md.append("")
    md.append("Full machine-readable evidence: `B1-C20-EVIDENCE.json`. Raw k6, correctness, observability, application, PostgreSQL and host telemetry are included in the artifact.")
    (REPORT_DIR / "B1-C20-EVIDENCE.md").write_text("\n".join(md) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"B1-C20 summary failed: {exc}", file=sys.stderr)
        raise
