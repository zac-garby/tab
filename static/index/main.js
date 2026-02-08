function loadTabs() {
    fetch("/tabs")
        .then(r => {
            if (!r.ok) {
                throw new Error(r.status)
            }
            return r.json()
        })
        .then(json => json.forEach(name => {
            var a = document.createElement("a")
            a.textContent = name
            a.href = `/view?file=${name}`

            var li = document.createElement("li")
            li.appendChild(a)

            document.getElementById("tabs").appendChild(li)
        }))
        .catch(err => {
            console.error(err)
        })
}

function onPaste(e) {
    window.setTimeout(() => {
        document.getElementById("form").submit()
    }, 150)
}
