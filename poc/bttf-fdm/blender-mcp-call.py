#!/usr/bin/env python3
"""Helper to call Blender MCP tools via stdio protocol."""
import json
import subprocess
import sys
import time

def call_tool(tool_name, arguments, timeout=300):
    """Call a Blender MCP tool and return the result."""
    init_msg = json.dumps({
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "blender-mcp-caller", "version": "1.0"}
        },
        "id": 1
    })

    initialized_msg = json.dumps({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    })

    call_msg = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        },
        "id": 2
    })

    stdin_data = f"{init_msg}\n{initialized_msg}\n{call_msg}\n"

    proc = subprocess.Popen(
        ["uvx", "blender-mcp"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    try:
        stdout, stderr = proc.communicate(input=stdin_data, timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        print(f"ERROR: Timeout after {timeout}s", file=sys.stderr)
        return None

    # Parse responses - find the tool call result (id: 2)
    for line in stdout.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            if msg.get("id") == 2:
                return msg.get("result", msg)
        except json.JSONDecodeError:
            continue

    # If we didn't find id:2, print everything for debugging
    print(f"STDERR: {stderr[:500]}", file=sys.stderr)
    print(f"STDOUT: {stdout[:1000]}", file=sys.stderr)
    return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: blender-mcp-call.py <tool_name> [json_args]")
        sys.exit(1)

    tool_name = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    result = call_tool(tool_name, args)
    if result:
        print(json.dumps(result, indent=2))
    else:
        print("No result received", file=sys.stderr)
        sys.exit(1)
