const socket = io()

socket.on('disconnect', function(){
    socket = io()
})

let serverData = {'centri': 'Centri'}

function loadData() {
    serverData = JSON.parse(document.getElementById('serverData').innerHTML)

    const objDiv = document.getElementById('messageBox')

    objDiv.scrollTop = objDiv.scrollHeight
}

async function encode(text){
    const response = await fetch('/api/encode', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({text: text}),
        cache: 'default'
    })

    const rawResponse = await response.json()
    const information = rawResponse.information

    return information
}

function getCookie(cname) {
    let name = cname + '='
    let decodedCookie = decodeURIComponent(document.cookie)
    let ca = decodedCookie.split(';')
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i]
        while (c.charAt(0) == ' ') {
            c = c.substring(1)
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length)
        }
    }
    return ''
}

async function sendMessage() {
    const message = document.getElementById('message').value
    const encodedMessage = await encode(message)

    const token = getCookie('token')

    const sendingData = JSON.stringify({'message': encodedMessage, 'chatHash': serverData['chatHash'], 'token': token})

    socket.emit('newMessage', sendingData)

    document.getElementById('message').value = ''
}

async function deleteMessage(messageHash) {
    const response = await fetch('/api/deletemessage', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({chatHash: serverData['chatHash'], messageHash: messageHash}),
        cache: 'default'
    })
}

socket.on('callMessage', async function(callData){
    const jsonData = JSON.parse(callData)
    let chat = jsonData.chat
    let messageHash = jsonData.messageHash 

    if (chat == serverData['chatHash']) {
        const response = await fetch('/api/getmessage', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({chatHash: chat, messageHash: messageHash}),
            cache: 'default'
        })

        const rawResponse = await response.json()
        const information = rawResponse.information

        const objDiv = document.getElementById('messageBox')

        let bottom = false

        if (objDiv.scrollHeight - objDiv.scrollTop === objDiv.clientHeight) {
            bottom = true
        }

        objDiv.innerHTML = objDiv.innerHTML + information

        if (bottom) {
            objDiv.scrollTop = objDiv.scrollHeight
        }
    }
})

socket.on('deleteMessage', async function(deleteData){
    const jsonData = JSON.parse(deleteData)
    let chat = jsonData.chatHash
    let messageHash = jsonData.messageHash 

    if (chat == serverData['chatHash']) {
        document.getElementById(messageHash).remove()
    }
})