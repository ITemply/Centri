async function signupUser() {
    let username = document.getElementById('username').value
    let password = document.getElementById('password').value
    const userSignupData = {'username': username, 'password': password}

    document.getElementById('error').innerHTML = ''
    
    const response = await fetch('/api/newsignup', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userSignupData),
        cache: 'default'
    })

    const rawResponse = await response.json()
    const information = rawResponse.information

    document.getElementById('error').innerHTML = information

    if (information == 'Signed Up') {
        const token = rawResponse.token
        document.cookie = 'username=' + username + '; Secure'
        document.cookie = 'token=' + token + '; Secure'

        window.location.href = '/home'
    }
}