async function signinUser() {
    let username = document.getElementById('username').value
    let password = document.getElementById('password').value
    const userSignupData = {'username': username, 'password': password}

    const response = await fetch('/newsignin', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userSignupData),
        cache: 'default'
    })

    const rawResponse = await response.json()
    alert(JSON.stringify(rawResponse))
}