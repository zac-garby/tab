from flask import Flask, request, Response, send_from_directory
from pathlib import Path
import requests

app = Flask(__name__, static_folder="static")
tab_path = Path("tabs").resolve()

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
    files = [f.name for f in tab_path.iterdir() if f.is_file()]
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
    elif fp.exists():
        return "tab already exists!", 400

    fp.write_bytes(request.data)
    return "ok", 201


# @app.post("/tab")
# def post_tab():
#     ...

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
