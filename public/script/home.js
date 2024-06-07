let serverData = {'centri': 'Centri'}

function signOut() {
    document.cookie = 'token= ; Secure'
    document.cookie = 'username= ; Secure'

    window.location.href = '/'
}

function loadData() {
    serverData = JSON.parse(document.getElementById('serverData').innerHTML)
}

async function createDM() {
    const dmingUser = document.getElementById('dmUsername').value

    document.getElementById('error').innerHTML = ''

    if (dmingUser == serverData.dmUsername) {
        document.getElementById('error').innerHTML = 'Unable to DM Yourself'
        return
    } else if (dmingUser == '' || dmingUser === undefined || dmingUser === null) {
        document.getElementById('error').innerHTML = 'User is Required to DM'
        return
    }

    // e58af0a29dce251bd21faa9c03ee274e

    const response = await fetch('/createdm', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({dmUsername: dmingUser}),
        cache: 'default'
    })

    const rawResponse = await response.json()
    const information = rawResponse.information

    document.getElementById('error').innerHTML = information
}