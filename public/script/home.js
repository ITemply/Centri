function signOut() {
    document.cookie = 'token= ; Secure'
    document.cookie = 'username= ; Secure'

    window.location.href = '/'
}