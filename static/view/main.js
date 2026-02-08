var gap = 6
var out, content, lines

function setup() {
    out = document.getElementById("output")
    let params = new URLSearchParams(window.location.search)
    let input = params.get("input")

    if (params.has("input") && input && input.trim().length > 0) {
        content = input
        lines = content.split("\n")
        typeset()
    } else if (params.has("file")) {
        let file = params.get("file")
        loadUrl(`/tab/${file}`)
    } else if (params.has("url")) {
        let url = params.get("url")
        loadUrl(`/download?url=${encodeURIComponent(url)}`)
    } else {
        content = "No input given!\n\n(use ?input=... or ?url=...)"
        lines = content.split("\n")
        typeset()
    }
}

function loadUrl(url) {
    fetch(url)
        .then(r => {
            if (!r.ok) {
                throw new Error(r.status)
            }
            return r.text()
        })
        .then(text => {
            content = text
            lines = content.split("\n")
            typeset()
        })
        .catch(err => {
            console.error(err)
            lines = err.toString().split("\n")
        })
}

function save() {
    let name = prompt("What should I call it?").trim()

    fetch(`/tab/${name}.txt`, {
        method: "POST",
        body: content,
        headers: { "Content-Type": "text/plain" }
    }).then(r => {
        if (!r.ok) {
            throw new Error(r.status)
        }

        location.search = `?file=${name}.txt`
    }).catch(err => {
        alert("failed! " + err.toString())
        console.error(err)
    })
}

function typeset() {
    let maxWidth = 0
    for (var line of lines) {
        if (line.length > maxWidth) {
            maxWidth = line.length
        }
    }

    var computed = window.getComputedStyle(out, null)
    var lineHeight = parseFloat(computed.getPropertyValue("line-height"))
    var height = parseFloat(computed.getPropertyValue("height"))

    var outputHeight = Math.floor(height / lineHeight)
    var output = []

    for (var i = 0; i < outputHeight; i++) {
        output.push("")
    }

    var y = 0

    var cleanBreaks = document.getElementById("clean-breaks").checked

    for (var l = 0; l < lines.length; l++) {
        let line = lines[l]

        if (line.trim().length == 0 && y == 0) continue

        if (cleanBreaks && line.trim().length == 0) {
            var nextGap = -1
            for (var m = l+1; m < lines.length; m++) {
                if (lines[m].trim().length == 0) {
                    nextGap = m - l
                    break
                }
            }

            if (y + nextGap > outputHeight) {
                for (; y < outputHeight; y++) {
                    output[y] += " ".repeat(gap + maxWidth)
                }

                y = 0
                continue
            }
        }

        output[y] += line
        output[y] += " ".repeat(gap + maxWidth - line.length)
        y = (y + 1) % outputHeight
    }

    out.innerHTML = ""

    for (var i = 0; i < outputHeight; i++) {
        var el = document.createElement("pre")
        var lineContent = output[i]
            .replaceAll("\n", "")
            .replaceAll("\r", "")

        if (document.getElementById("colours").checked) {
            lineContent = fancyColours(lineContent)
        }

        el.innerHTML = lineContent
        out.appendChild(el)
    }
}

function fancyColours(str) {
    var hideNoise = document.getElementById("hide-noise").checked

    return str
        .replaceAll(/./g, c => {
            if (c == "-") {
                return `<span class="punct">─</span>`
            } else if ("=.|~".indexOf(c) >= 0) {
                return `<span class="punct">${c}</span>`
            } else if (c == "p" || c == "h") {
                return `<span class="ph">${c}</span>`
            } else if ("0123456789".indexOf(c) >= 0) {
                return `<span class="digit">${c}</span>`
            } else if (hideNoise) {
                return `<span class="hidden">${c}</span>`
            } else {
                return c
            }
        })

}
