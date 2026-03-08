var gap = 6
var out, content, lines, lineMap
var annotations = []
var currentFile = null
var adminPassword = null
var charWidth = 7
var outputLineHeight = 13
const OUTPUT_PADDING = 40

function setup() {
    out = document.getElementById("output")
    document.querySelector(".output-wrapper").addEventListener("click", handleOutputClick)

    var params = new URLSearchParams(window.location.search)
    var input = params.get("input")

    if (params.has("input") && input && input.trim().length > 0) {
        content = input
        lines = content.split("\n")
        typeset()
    } else if (params.has("file")) {
        currentFile = params.get("file")
        loadUrl(`/tab/${currentFile}`)
        loadAnnotations()
    } else if (params.has("url")) {
        loadUrl(`/download?url=${encodeURIComponent(params.get("url"))}`)
    } else {
        content = "No input given!\n\n(use ?input=... or ?url=...)"
        lines = content.split("\n")
        typeset()
    }
}

function loadUrl(url) {
    fetch(url)
        .then(r => {
            if (!r.ok) throw new Error(r.status)
            return r.text()
        })
        .then(text => {
            content = text
            lines = content.split("\n")
            typeset()
        })
        .catch(err => {
            console.error(err)
            content = err.toString()
            lines = content.split("\n")
            typeset()
        })
}

function loadAnnotations() {
    if (!currentFile) return
    fetch(`/annotations/${currentFile}`)
        .then(r => r.json())
        .then(data => {
            annotations = data
            renderAnnotations()
        })
        .catch(err => console.error("annotations load failed:", err))
}

// ── saving ────────────────────────────────────────────────────────────────────

function save() {
    var name = prompt("What should I call it? Enter the name without any file extensions.")
    if (name == null) return
    name = name.trim()
    if (!name) return
    doSave(name, null)
}

function doSave(name, password) {
    var headers = { "Content-Type": "text/plain" }
    if (password) headers["X-Admin-Password"] = password

    fetch(`/tab/${name}.txt`, { method: "POST", body: content, headers })
        .then(r => {
            if (r.status === 409) {
                var pw = prompt(`"${name}.txt" already exists. Enter admin password to overwrite:`)
                if (pw != null) doSave(name, pw)
                return
            }
            if (r.status === 403) { alert("Incorrect password."); return }
            if (!r.ok) { alert("Save failed: " + r.status); return }
            location.search = `?file=${name}.txt`
        })
        .catch(err => { alert("Save failed: " + err); console.error(err) })
}

function saveEdits() {
    if (!currentFile) { save(); return }

    var pw = adminPassword
    if (!pw) {
        pw = prompt("Enter admin password:")
        if (!pw) return
    }

    fetch(`/tab/${currentFile}`, {
        method: "PUT",
        body: content,
        headers: { "Content-Type": "text/plain", "X-Admin-Password": pw }
    }).then(r => {
        if (r.status === 403) { alert("Incorrect password."); adminPassword = null; return }
        if (!r.ok) { alert("Save failed: " + r.status); return }
        adminPassword = pw
        var btn = document.getElementById("save-edits")
        var orig = btn.textContent
        btn.textContent = "saved!"
        setTimeout(() => { btn.textContent = orig }, 1500)
    }).catch(err => { alert("Save failed: " + err); console.error(err) })
}

// ── edit mode ─────────────────────────────────────────────────────────────────

var editMode = false

function toggleEdit() {
    editMode = document.body.classList.toggle("editing")
    document.getElementById("edit-toggle").textContent = editMode ? "stop editing" : "edit"
    if (editMode) document.getElementById("edit-area").focus()
    typeset()
}

// Convert a linear position in the column-flow textarea text to a source {line, char}
function colFlowPosToSource(pos, text) {
    var row = 0, col = 0
    for (var i = 0; i < pos; i++) {
        if (text[i] === "\n") { row++; col = 0 }
        else col++
    }
    for (var l = 0; l < lines.length; l++) {
        var entry = lineMap[l]
        if (!entry) continue
        if (entry.row !== row) continue
        if (col >= entry.colOffset && col < entry.colOffset + lines[l].length) {
            return { line: l, char: col - entry.colOffset }
        }
    }
    return null
}

function onEditKeydown(e) {
    if (e.ctrlKey || e.metaKey) return
    var ta = e.target
    var pos = ta.selectionStart

    if (e.key.length === 1 && !e.altKey) {
        // Overwrite character at source position
        e.preventDefault()
        var src = colFlowPosToSource(pos, ta.value)
        if (src) {
            var line = lines[src.line]
            lines[src.line] = line.slice(0, src.char) + e.key +
                (src.char < line.length ? line.slice(src.char + 1) : "")
            content = lines.join("\n")
        }
        typeset()
        document.getElementById("edit-area").selectionStart =
        document.getElementById("edit-area").selectionEnd = pos + 1
    } else if (e.key === "Backspace") {
        // Move cursor back without deleting (overwrite mode)
        e.preventDefault()
        ta.selectionStart = ta.selectionEnd = Math.max(0, pos - 1)
        var pos = ta.selectionStart
        var src = colFlowPosToSource(pos, ta.value)
        if (src) {
            var line = lines[src.line]
            lines[src.line] = line.slice(0, src.char) + "-" +
                (src.char < line.length ? line.slice(src.char + 1) : "")
            content = lines.join("\n")
        }
        typeset()
    } else if (e.key === "Delete") {
        // Replace source char with space
        e.preventDefault()
        var src = colFlowPosToSource(pos, ta.value)
        if (src && src.char < lines[src.line].length) {
            var line = lines[src.line]
            lines[src.line] = line.slice(0, src.char) + " " + line.slice(src.char + 1)
            content = lines.join("\n")
            typeset()
        }
        document.getElementById("edit-area").selectionStart =
        document.getElementById("edit-area").selectionEnd = pos
    } else if (e.key === "Enter") {
        // Jump to start of next visual row
        e.preventDefault()
        var nextNL = ta.value.indexOf("\n", pos)
        ta.selectionStart = ta.selectionEnd = nextNL !== -1 ? nextNL + 1 : pos
    } else if (e.key === "Tab") {
        e.preventDefault()
    }
}

// ── annotations ───────────────────────────────────────────────────────────────

function toggleAnnotate() {
    if (!document.body.classList.contains("annotating")) {
        var pw = adminPassword
        if (!pw) {
            pw = prompt("Enter admin password to annotate:")
            if (!pw) return
            adminPassword = pw
        }
        document.body.classList.add("annotating")
        document.getElementById("annotate-toggle").textContent = "stop annotating"
    } else {
        document.body.classList.remove("annotating")
        document.getElementById("annotate-toggle").textContent = "annotate"
    }
    renderAnnotations()
}

function handleOutputClick(e) {
    if (!document.body.classList.contains("annotating")) return

    var wrapper = document.querySelector(".output-wrapper")
    var rect = wrapper.getBoundingClientRect()
    var px = e.clientX - rect.left + wrapper.scrollLeft
    var py = e.clientY - rect.top + wrapper.scrollTop

    var pos = pixelToSourcePos(px, py)
    if (!pos) return

    var text = prompt("Annotation text:")
    if (!text || !text.trim()) return

    annotations.push({ line: pos.line, char: pos.char, text: text.trim() })
    persistAnnotations()
    renderAnnotations()
}

function editAnnotation(idx) {
    var ann = annotations[idx]
    var newText = prompt(`Edit annotation (leave empty to delete):\n\nCurrent: "${ann.text}"`)
    if (newText === null) return
    if (!newText.trim()) {
        annotations.splice(idx, 1)
    } else {
        annotations[idx].text = newText.trim()
    }
    persistAnnotations()
    renderAnnotations()
}

function persistAnnotations() {
    if (!currentFile || !adminPassword) return
    fetch(`/annotations/${currentFile}`, {
        method: "POST",
        body: JSON.stringify(annotations),
        headers: { "Content-Type": "application/json", "X-Admin-Password": adminPassword }
    }).catch(err => console.error("failed to save annotations:", err))
}

function toggleAnnotationVisibility() {
    var show = document.getElementById("show-annotations").checked
    document.querySelectorAll(".annotation-marker").forEach(el => {
        el.style.display = show ? "" : "none"
    })
}

function renderAnnotations() {
    document.querySelectorAll(".annotation-marker").forEach(el => el.remove())
    if (!annotations || !annotations.length || !lineMap) return

    var annotating = document.body.classList.contains("annotating")
    var wrapper = document.querySelector(".output-wrapper")

    annotations.forEach((ann, idx) => {
        var entry = lineMap[ann.line]
        if (!entry) return

        var col = entry.colOffset + (ann.char || 0)
        var top = OUTPUT_PADDING + entry.row * outputLineHeight - 12
        var left = OUTPUT_PADDING + col * charWidth

        var marker = document.createElement("div")
        marker.className = "annotation-marker"
        marker.style.top = top + "px"
        marker.style.left = left + "px"
        marker.dataset.text = ann.text

        var badge = document.createElement("div")
        badge.className = "annotation-badge"
        badge.textContent = ann.text.split("\n")[0]
        marker.appendChild(badge)

        if (annotating) {
            marker.addEventListener("click", e => {
                e.stopPropagation()
                editAnnotation(idx)
            })
        }

        var showEl = document.getElementById("show-annotations")
        if (showEl && !showEl.checked) marker.style.display = "none"

        wrapper.appendChild(marker)
    })
}

function pixelToSourcePos(px, py) {
    var row = Math.floor((py - OUTPUT_PADDING) / outputLineHeight)
    var col = Math.floor((px - OUTPUT_PADDING) / charWidth)

    console.log("at pos", px, py, "row, col =", row, col)

    for (var l = 0; l < lines.length; l++) {
        var entry = lineMap[l]
        if (!entry) continue
        if (entry.row !== row) continue
        if (col < entry.colOffset) continue
        
        console.log("l =", l, "entry:", entry, "at line", lines[l])
        var len = lines[l].length
        if (col < entry.colOffset + len) {
            return { line: l, char: col - entry.colOffset }
        } else {
            // Need to extend the line so that it fits the anno
            var diff = col - (entry.colOffset + len)
            lines[l] = lines[l] + " ".repeat(diff)
            console.log("new line:", lines[l])
            return { line: l, char: col - entry.colOffset }
        }
    }
    return null
}

// ── typesetting ───────────────────────────────────────────────────────────────

function measureChars() {
    var test = document.createElement("pre")
    test.style.cssText = [
        "position:absolute", "visibility:hidden",
        "font-family:Menlo,Consolas,Monaco,'Liberation Mono','Lucida Console',monospace",
        "font-size:10pt", "line-height:1em", "margin:0", "padding:0"
    ].join(";")
    test.textContent = "M"
    document.body.appendChild(test)
    var rect = test.getBoundingClientRect()
    charWidth = rect.width
    outputLineHeight = rect.height
    document.body.removeChild(test)
}

function typeset() {
    measureChars()

    var maxWidth = 0
    for (var line of lines) {
        if (line.length > maxWidth) maxWidth = line.length
    }

    var computed = window.getComputedStyle(out, null)
    var lineHeightPx = parseFloat(computed.getPropertyValue("line-height"))
    var height = parseFloat(computed.getPropertyValue("height"))
    var outputHeight = Math.floor(height / lineHeightPx)

    var output = []
    lineMap = new Array(lines.length)
    for (var i = 0; i < outputHeight; i++) output.push("")

    var y = 0
    var cleanBreaks = document.getElementById("clean-breaks").checked

    for (var l = 0; l < lines.length; l++) {
        var line = lines[l]

        if (line.trim().length == 0 && y == 0) continue

        if (cleanBreaks && line.trim().length == 0) {
            var nextGap = -1
            for (var m = l + 1; m < lines.length; m++) {
                if (lines[m].trim().length == 0) {
                    nextGap = m - l
                    break
                }
            }

            if (nextGap !== -1 && y + nextGap > outputHeight) {
                for (; y < outputHeight; y++) {
                    output[y] += " ".repeat(gap + maxWidth)
                }
                y = 0
                continue
            }
        }

        lineMap[l] = { row: y, colOffset: output[y].length }
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

    if (editMode) {
        var editEl = document.getElementById("edit-area")
        if (editEl) {
            var savedSel = editEl.selectionStart
            editEl.value = output.join("\n")
            editEl.selectionStart = editEl.selectionEnd = savedSel
        }
    }

    renderAnnotations()
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
