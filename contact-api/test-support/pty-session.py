"""Test-only: run one command on a fresh pseudo-terminal, report what it showed.

argv[1] is JSON {"argv": [...], "env": {...}, "steps": [...], "timeout": s}.
Steps run in order: {"wait": text} (in output after the previous wait),
{"write": text}, {"snapshot": name}, {"sleep": s}, {"signal": "SIGTERM"}.
A named snapshot also records whether the command was still running.
stdout gets one JSON report: everything read from the master side (base64),
the exit status (negative = signal) and termios snapshots of the slave side
("before" the start, each named snapshot, "after" the exit).
"""
import base64
import fcntl
import json
import os
import select
import signal
import subprocess
import sys
import termios
import time


def snapshot(fd):
    iflag, oflag, cflag, lflag, ispeed, ospeed, cc = termios.tcgetattr(fd)
    cc = [c if isinstance(c, int) else c[0] for c in cc]
    return {"echo": bool(lflag & termios.ECHO), "icanon": bool(lflag & termios.ICANON),
            "attrs": [iflag, oflag, cflag, lflag, ispeed, ospeed, cc]}


def main():
    spec = json.loads(sys.argv[1])
    deadline = time.monotonic() + spec.get("timeout", 20)
    master, slave = os.openpty()
    report = {"before": snapshot(slave)}
    output = bytearray()

    def controlling_terminal():
        fcntl.ioctl(0, termios.TIOCSCTTY, 0)

    child = subprocess.Popen(spec["argv"], env=spec["env"], stdin=slave, stdout=slave,
                             stderr=slave, start_new_session=True,
                             preexec_fn=controlling_terminal)

    def pump(timeout):
        ready, _, _ = select.select([master], [], [], timeout)
        if ready:
            output.extend(os.read(master, 65536))
        return bool(ready)

    cursor = 0
    for step in spec["steps"]:
        if "wait" in step:
            needle = step["wait"].encode()
            while output.find(needle, cursor) < 0:
                if time.monotonic() > deadline or (child.poll() is not None and not pump(0.2)):
                    report["error"] = "missing output: " + step["wait"]
                    break
                pump(0.05)
            if "error" in report:
                break
            cursor = output.find(needle, cursor) + len(needle)
        elif "write" in step:
            os.write(master, step["write"].encode())
        elif "snapshot" in step:
            report[step["snapshot"]] = dict(snapshot(slave), alive=child.poll() is None)
        elif "sleep" in step:
            end = time.monotonic() + step["sleep"]
            while time.monotonic() < end:
                pump(0.02)
        elif "signal" in step:
            os.kill(child.pid, getattr(signal, step["signal"]))
    while child.poll() is None:
        if time.monotonic() > deadline:
            report.setdefault("error", "timeout")
            child.kill()
        pump(0.05)
    while pump(0.1):
        pass
    report["after"] = snapshot(slave)
    report["code"] = child.wait()
    report["output"] = base64.b64encode(bytes(output)).decode()
    print(json.dumps(report))


main()
