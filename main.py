from flask import Flask, request, Response, send_from_directory
from pathlib import Path
import requests
import os

app = Flask(__name__, static_folder="static")
tab_path = Path("tabs").resolve()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


def check_password():
    if not ADMIN_PASSWORD:
        return True  # dev mode: no password set = open access
    return request.headers.get("X-Admin-Password", "") == ADMIN_PASSWORD


@app.route("/")
def index():
    return send_from_directory("static/index", "index.html")


@app.route("/view/")
def view():
    return send_from_directory("static/view", "index.html")


@app.route("/download")
def download():
    url = request.args.get("url")
    if not url:
        return "missing url", 400

    r = requests.get(url, timeout=10)
    return Response(
        r.content,
        status=r.status_code,
        content_type=r.headers.get("Content-Type")
    )


@app.get("/tabs")
def get_tabs():
    files = [f.name for f in tab_path.iterdir() if f.is_file() and f.suffix == ".txt"]
    return files


@app.get("/tab/<name>")
def get_content(name: str):
    fp = tab_path / name

    if fp.resolve().parent != tab_path:
        return "invalid tab name", 400
    elif not fp.exists():
        return f"no tab named {name} exists", 400
    else:
        return fp.read_text()


@app.post("/tab/<name>")
def save_tab(name: str):
    fp = (tab_path / name).with_suffix(".txt").resolve()

    if fp.parent != tab_path:
        return "invalid tab name", 400
    if fp.exists() and not check_password():
        return "tab already exists", 409

    fp.write_bytes(request.data)
    return "ok", 201


@app.put("/tab/<name>")
def update_tab(name: str):
    fp = (tab_path / name).resolve()

    if fp.parent != tab_path:
        return "invalid tab name", 400
    if not check_password():
        return "unauthorized", 403
    if not fp.exists():
        return f"no tab named {name} exists", 404

    fp.write_bytes(request.data)
    return "ok", 200


@app.get("/annotations/<name>")
def get_annotations(name: str):
    stem = Path(name).stem
    fp = (tab_path / f"{stem}.annotations.json").resolve()

    if fp.parent != tab_path:
        return "invalid name", 400
    if not fp.exists():
        return "[]", 200, {"Content-Type": "application/json"}

    return fp.read_text(), 200, {"Content-Type": "application/json"}


@app.post("/annotations/<name>")
def save_annotations(name: str):
    stem = Path(name).stem
    fp = (tab_path / f"{stem}.annotations.json").resolve()

    if fp.parent != tab_path:
        return "invalid name", 400
    if not check_password():
        return "unauthorized", 403

    fp.write_bytes(request.data)
    return "ok", 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
