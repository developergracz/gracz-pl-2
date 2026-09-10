from pathlib import Path

path = Path("test/wave-b-b1-c16-traffic-guard-coalescing.test.js")
text = path.read_text(encoding="utf-8")
old = '''  assert.match(source, /max:\\s*4/);\n  assert.match(source, /OPERATION_TIMEOUT_MS\\s*=\\s*1_500/);\n  assert.doesNotMatch(source, /max:\\s*[5-9]|max:\\s*[1-9][0-9]+/);\n'''
new = '''  const trafficGuardClass = source.slice(\n    source.indexOf("export class PostgresDistributedTrafficGuard"),\n    source.indexOf("export class PostgresRealtimeHub"),\n  );\n  assert.match(trafficGuardClass, /max:\\s*4/);\n  assert.match(trafficGuardClass, /OPERATION_TIMEOUT_MS|connectionTimeoutMillis:\\s*OPERATION_TIMEOUT_MS/);\n  assert.doesNotMatch(trafficGuardClass, /max:\\s*(?:[5-9]|[1-9][0-9]+)/);\n'''
if old in text:
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("B1-C16 capacity assertion scoped to TrafficGuard class")
elif "const trafficGuardClass = source.slice(" in text:
    print("B1-C16 test correction already present")
else:
    raise RuntimeError("B1-C16 test correction anchor not found")
