#!/usr/bin/env python3
"""Copy admin edits into data/*.json so every visitor gets them from the site itself."""
import json
import pathlib
import re
import time
import urllib.request

API = "https://api.telegra.ph/getPage/{}?return_content=true"
MANIFEST = "StudiaMaiCMS-10-10"
ROOT = pathlib.Path(__file__).resolve().parents[1] / "data"
THEME_COLOR = {
    "sage": "#6E9A84",
    "powder": "#C48980",
    "champagne": "#C4A574",
    "lavender": "#A08BB8",
    "tide": "#2A8C96",
    "silver": "#8B939E",
    "pearl": "#A8B0BA",
    "cocoa": "#A6846C",
    "noir": "#2A2E34",
    "rose": "#C48B95",
    "olive": "#8A9168",
}
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


def stamp_theme(theme_id):
    page = ROOT.parent / "index.html"
    if not page.exists():
        return False
    text = page.read_text(encoding="utf-8")
    theme_id = theme_id if theme_id in THEME_COLOR else "mint"
    if theme_id == "mint":
        html = '<html lang="ru">'
        color = "#00D4A8"
    else:
        html = f'<html lang="ru" data-theme="{theme_id}">'
        color = THEME_COLOR[theme_id]
    updated = re.sub(r'<html lang="ru"(?: data-theme="[a-z]+")?>', html, text, count=1)
    updated = re.sub(
        r'<meta name="theme-color" content="#[0-9A-Fa-f]+">',
        f'<meta name="theme-color" content="{color}">',
        updated,
        count=1,
    )
    if updated == text:
        return False
    page.write_text(updated, encoding="utf-8")
    print("updated index.html theme", theme_id)
    return True


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
        if name == "config.json":
            enabled = obj.get("intakeEnabled") is True
            obj = {"intakeEnabled": enabled}
        if name == "services.json" and target.exists():
            try:
                previous_obj = json.loads(target.read_text(encoding="utf-8"))
            except Exception:
                previous_obj = None
            if isinstance(previous_obj, dict):
                for key, prev in previous_obj.items():
                    nxt = obj.get(key)
                    if not isinstance(prev, dict) or not isinstance(nxt, dict):
                        continue
                    prev_items = prev.get("items") or []
                    next_items = nxt.get("items") or []
                    if prev_items and not next_items:
                        nxt = dict(nxt)
                        nxt["items"] = prev_items
                        if str(prev.get("desc") or "").strip():
                            nxt["desc"] = prev["desc"]
                        if str(prev.get("title_html") or "").strip():
                            nxt["title_html"] = prev["title_html"]
                        obj[key] = nxt
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
        if name == "theme.json" and stamp_theme(str(obj.get("id") or "mint")):
            changed = True
    if changed:
        version = ROOT / "version.json"
        version.write_text(json.dumps({"v": int(time.time() * 1000)}) + "\n", encoding="utf-8")
        print("updated version.json")
    else:
        print("no cms changes")


if __name__ == "__main__":
    main()
