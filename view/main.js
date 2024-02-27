var gap = 6

function typeset() {
    let out = document.getElementById("output")
    let queryParams = new URLSearchParams(window.location.search)
    let input = queryParams.get("input") || "no input given."
    let lines = input.split("\n")
    
    var maxWidth = 0
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