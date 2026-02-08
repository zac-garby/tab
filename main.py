from flask import Flask, request, Response, send_from_directory
import requests

app = Flask(__name__, static_folder="static")

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

if __name__ == "__main__":
    app.run(debug=True)
