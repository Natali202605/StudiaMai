#!/usr/bin/env python3
"""Copy admin edits into data/*.json so every visitor gets them from the site itself."""
import json
import pathlib
import time
import urllib.request

API = "https://api.telegra.ph/getPage/{}?return_content=true"
MANIFEST = "StudiaMaiCMS-10-10"
ROOT = pathlib.Path(__file__).resolve().parents[1] / "data"
FILES = {
    "theme": "theme.json",
    "content": "content.json",
    "services": "services.json",
    "config": "config.json",
    "images": "images.json",
}


def collect(node):
    if isinstance(node, str):
        return node
    if not isinstance(node, dict):
        return ""
    return "".join(collect(child) for child in node.get("children") or [])


def read_page(path):
    req = urllib.request.Request(API.format(path), headers={"User-Agent": "StudiaMai/1.0"})
    with urllib.request.urlopen(req, timeout=25) as res:
        data = json.load(res)
    if not data.get("ok"):
        raise RuntimeError(data.get("error") or "read failed")
    return "".join(collect(node) for node in (data.get("result") or {}).get("content") or [])


def main():
    try:
        manifest = json.loads(read_page(MANIFEST))
    except Exception as exc:
        print("manifest skipped:", exc)
        return
    docs = manifest.get("docs") or {}
    changed = False
    for key, name in FILES.items():
        paths = docs.get(key) or []
        if not paths:
            continue
        try:
            text = "".join(read_page(path) for path in paths)
            obj = json.loads(text) if text.strip() else None
        except Exception as exc:
            print(name, "skipped:", exc)
            continue
        if not isinstance(obj, dict) or not obj:
            continue
        target = ROOT / name
        encoded = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
        previous = target.read_text(encoding="utf-8") if target.exists() else ""
        try:
            same = json.loads(previous) == obj
        except Exception:
            same = False
        if same:
            continue
        target.write_text(encoded, encoding="utf-8")
        changed = True
        print("updated", name)
    if changed:
        version = ROOT / "version.json"
        version.write_text(json.dumps({"v": int(time.time() * 1000)}) + "\n", encoding="utf-8")
        print("updated version.json")
    else:
        print("no cms changes")


if __name__ == "__main__":
    main()
