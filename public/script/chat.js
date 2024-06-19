var socket = io()

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

function base64ToBlob(base64String, contentType = '') {
    const byteCharacters = atob(base64String);
    const byteArrays = [];

    for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
    }

    const byteArray = new Uint8Array(byteArrays);
    return new Blob([byteArray], { type: contentType });
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

    document.getElementById('message').value = ''

    socket.emit('newMessage', sendingData)
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

async function loadMedia(mediaHash) {
    document.getElementById(mediaHash).style.display = 'none'

    const response = await fetch('/api/getmedia', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({mediaHash: mediaHash}),
        cache: 'default'
    })

    const rawResponse = await response.json()
    const information = rawResponse.information
    let mediaData = information.mediaData

    const mediaBlob = base64ToBlob(mediaData.split(',')[1], 'image/png')
    const mediaURL = URL.createObjectURL(mediaBlob)

    document.getElementById(mediaHash).src = mediaURL
    document.getElementById('a-' + mediaHash).href = mediaURL

    document.getElementById(mediaHash).style.display = 'inline'
    document.getElementById('loader-' + mediaHash).style.display = 'none'
}

async function uploadMessage() {
    const fileinput = document.getElementById('uploadfileid').files[0]

    document.getElementById('imageData').innerHTML = fileinput.name
  
    reader = new FileReader();
  
    reader.onloadend = async function() {
      var b64 = reader.result
      response = confirm('Are you sure you want to upload the file, ' + fileinput.name + '?')
  
      if (response) {
        const token = getCookie('token')
  
        const fileData = {'fileData': b64, 'chatHash': serverData['chatHash'], 'token': token}
    
        socket.emit('newFile', JSON.stringify(fileData))
        document.getElementById('imageData').innerHTML = 'File Uploaded'
      } else {
        document.getElementById('imageData').innerHTML = ''
      }
    }
  
    reader.readAsDataURL(fileinput);
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

document.addEventListener('keypress', async function(event) {
    if (event.key === 'Enter') {
        await sendMessage()
    } 
  })
  