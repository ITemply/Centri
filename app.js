const express = require('express')
const path = require('node:path')
const bodyParser = require('body-parser')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server, {maxHttpBufferSize: 3.05e6, pingTimeout: 60000})
const dotenv = require('dotenv')
const mysql = require('mysql')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
dotenv.config()

// 3 = Owner
// 2 = Admin
// 1 = Moderator

app.set('views', path.join(__dirname, 'public'))
app.use('/images', express.static('images'));
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(cookieParser())

const databaseUrl = process.env.DATABASE_URL
const username = process.env.USERNAME
const password = process.env.PASSWORD
const port = process.env.PORT

const algorithm = process.env.ALG
const key = process.env.KEY
const iv = process.env.IV

const validChars = process.env.VALID_CHARS
const validUsernameChars = process.env.VALID_UNAME_CHARS

const sqlConnection = mysql.createPool({
    connectionLimit: 100,
    host: databaseUrl,
    user: username,
    password: password,
    port: port
})

async function executeSQL(sql){
  return new Promise((resolve, reject) =>{
      try{
        sqlConnection.query(sql, function(err, result) {
            if (err){
                return reject(err)
            }
            return resolve(result)
        })
      }
      catch(e){
          reject(e)
      }
  })
}

function randomString(length) {
    let result = ''
    const characters = validChars
    const charactersLength = characters.length
    let counter = 0

    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
      counter += 1
    }

    return result
}

function hash(string) {
    return crypto.createHash('sha256').update(string).digest('hex')
}

function base64Image(file){
    return fs.readFileSync(file, 'base64')
}

function encode(text, ekey, eiv) {
    let base = btoa(text)
    let cipher = crypto.createCipheriv(algorithm, ekey, eiv)
    let encrypted = cipher.update(base)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return encrypted.toString('hex')
 }

function decode(text, dkey, div) {
    let encryptedText = Buffer.from(text, 'hex')
    let decipher = crypto.createDecipheriv('aes-256-cbc', dkey, div)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return atob(decrypted.toString())
 }

function checkUsernameCharacters(inputString) {
    const characterList = new RegExp(`[^${validUsernameChars}]`, 'g')
    return !characterList.test(inputString)
}

function checkCharacters(inputString) {
    const characterList = new RegExp(`[^${validChars}]`, 'g')
    return !characterList.test(inputString)
}

async function checkCurrentUsername(checkUsername){
    const sqlCheck = await executeSQL('SELECT * FROM Centri.accounting WHERE checkUsername="' + checkUsername + '";')
    if (sqlCheck[0] === null) {
        return false
    } else if (sqlCheck[0] === undefined) {
        return false
    } else {
        return true       
    }
}

app.get('/', async function(req, res){
    res.cookie('centri', 'Centri')
    console.log('Sending [GET]: /')
    res.render('index')
})

app.get('/signup', async function(req, res){
    const cookies = req.cookies
    if (cookies['token']) {
        res.redirect('/home')
        return
    }

    console.log('Sending [GET]: /signup')
    res.render('signup')
})

app.get('/signin', async function(req, res){
    const cookies = req.cookies
    if (cookies['token']) {
        res.redirect('/home')
        return
    }

    console.log('Sending [GET]: /signin')
    res.render('signin')
})

app.get('/home', async function(req, res){
    const token = req.cookies.token
    if (token) {
        const userData = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '"')
        let encodedUsername = userData[0]['username']
        let chats = JSON.parse(userData[0]['chats'])
        let username = decode(userData[0]['username'], key, iv)

        let htmlChats = ''

        for (const chatInt in chats['chats']) {
            let currentChat = await executeSQL('SELECT * FROM Centri.chats WHERE chatHash ="' + chats['chats'][chatInt] + '"')
            let updatedSendTo = currentChat[0]['chatName'].replace(', ', '')
            let connectedWith = 'DM to <b>' + updatedSendTo.replace(username, '') + '</b>'
            htmlChats += '<div class="chat"><span class="chatName">' + connectedWith + '</span><br><input type="button" value="Open Chat" class="chatButton" onclick="openChat(`' + chats['chats'][chatInt] + '`)"> <input type="button" value="Close Chat" class="chatButton" onclick="closeChat(`' + chats['chats'][chatInt] + '`)"></div>'
        }

        console.log('Sending [GET]: /home')
        res.render('home', {serverData: JSON.stringify({'dmUsername': encodedUsername, 'chats': chats}), htmlChats: htmlChats})
    } else {
        res.redirect('/')
    }
})

app.get('/getcookies', async function(req, res){
    const redirectUrl = req.query.url
    if (redirectUrl === undefined) {
        res.redirect('/')
        return
    }

    console.log('Sending [GET]: /getcookies | REQUESTED URL: ' + redirectUrl)
    res.cookie('centri', 'Centri')
    res.redirect(redirectUrl)
})

app.get('/chat', async function(req, res){
    console.log('SENDING [GET]: /chat')
    res.redirect('/home?backType=2')
})

app.get('/chat/:chatHash', async function(req, res){
    const token = req.cookies.token
    if (token) {
        const userData = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '"')
        const chatHash = req.params.chatHash
        const userChats = JSON.parse(userData[0]['chats'])
        const username = decode(userData[0]['username'], key, iv)

        for (const chatInt in userChats['chats']) {
            if (userChats['chats'][chatInt] == chatHash) {
                const chatData = await executeSQL('SELECT * FROM Centri.chats WHERE chatHash="' + chatHash + '"')
                const messages = await executeSQL('SELECT * FROM Centri.messages WHERE chat="' + chatHash + '"')
                let updatedSendTo = chatData[0]['chatName'].replace(', ', '')
                let connectedWith = 'DM to ' + updatedSendTo.replace(username, '')

                let messageString = ''

                for (const messageInt in messages) {
                    const message = messages[messageInt]
                    let messageHash = message['messageHash']
                    let messageType = message['messageType']
                    let messageSender = message['messageSender']
                    let sentTime = message['sendingTime']
                    let seconds = new Date().getTime() / 1000
                    let day3Seconds = 129600
                    

                    let canDelete = ''

                    if (sentTime < seconds - day3Seconds) {
                        if (messageType == 1) {
                            await executeSQL('DELETE FROM Centri.messages WHERE messageHash="' + messageHash + '"')
                        } else if (messageType == 2) {
                            let messageData = message['messageContent']
                            await executeSQL('DELETE FROM Centri.messages WHERE messageHash="' + messageHash + '"')
                            await executeSQL('DELETE FROM Centri.media WHERE mediaHash="' + messageData + '"')
                        }
                    } else {
                        if (userData[0]['checkUsername'] == messageSender) {
                            canDelete = '<input type="button" value="Delete Message" id="deleteMessage" class="deleteMessage" onclick="deleteMessage(`' + messageHash + '`)">'
                        }
    
                        if (messageType == 1) {
                            let messageData = decode(message['messageContent'], key, iv)
                            let username = decode(message['messageUser'], key, iv)
    
                            messageString += '<div class="message" id="' + messageHash + '"><span class="username" id="username">' + username + ':</span> <span class="messageData">' + messageData + '</span> ' + canDelete + '</div>'
                        } else if (messageType == 2) {
                            let messageData = message['messageContent']
                            let username = decode(message['messageUser'], key, iv)
    
                            messageString += '<div class="message" id="' + messageHash + '"><span class="username" id="username">' + username + ':</span> <a href="" id="a-' + messageData + '" target="_blank" ><img class="sentMedia" src="" onerror="loadMedia(`' + messageData + '`)" id="' + messageData + '"></a> ' + canDelete + '</div>'
                        }
                    }
                }

                console.log('Sending [GET]: /chat/' + chatHash)
                res.render('chat', {serverData: JSON.stringify({'chatHash': chatHash}), messages: messageString, connectedWith: connectedWith})
                return
            }
        }
        res.redirect('/home?backType=1')
    } else {
        res.redirect('/')
    }
})

app.post('/api/getmedia', async function(req, res){
    const token = req.cookies.token
    if (token) {
        const jsonData = req.body
        let mediaHash = jsonData.mediaHash

        const userData = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '"')

        if (userData[0] === null) {
            res.send(JSON.stringify({information: 'User Not Found'}))
            return
        } else if (userData[0] === undefined) {
            res.send(JSON.stringify({information: 'User Not Found'}))
            return
        } else {
            const mediaData = await executeSQL('SELECT * FROM Centri.media WHERE mediaHash="' + mediaHash + '"')

            if (mediaData[0] === null) {
                res.send(JSON.stringify({'information': '[Unauthorized Media]: An error has been detected in loading a media file. Please wait a day or two for the media file to be cleared.'}))
                return 
            } else if (mediaData[0] === undefined) {
                res.send(JSON.stringify({'information': '[Unauthorized Media]: An error has been detected in loading a media file. Please wait a day or two for the media file to be cleared.'}))
                return
            } else {
                const media = await executeSQL('SELECT CONVERT(media USING utf8) FROM Centri.media WHERE mediaHash="' + mediaHash + '"')
                const mediaToLoad = media[0]['CONVERT(media USING utf8)']

                console.log('Sending [GET]: /api/getmedia/' + mediaHash)
                res.send(JSON.stringify({information: {mediaHash: mediaHash, mediaData: mediaToLoad}}))
                return
            }
        }
    } else {
        res.redirect('/')
        return
    }
})

app.post('/api/createdm', async function(req, res) {
    const jsonData = req.body
    let dmUsername = jsonData.dmUsername

    const token = req.cookies.token
    if (token) {
        const userData = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '"')
        let encodedUsername = userData[0]['username']

        if (dmUsername == encodedUsername) {
            res.send(JSON.stringify({information: 'Unable to DM Yourself'}))
            return
        } else {
            const checkData = await executeSQL('SELECT * FROM Centri.accounting WHERE username="' + dmUsername + '"')
            if (checkData[0] === null) {
                res.send(JSON.stringify({information: 'User Not Found'}))
                return
            } else if (checkData[0] === undefined) {
                res.send(JSON.stringify({information: 'User Not Found'}))
                return
            } else {
                if (dmUsername.lenght <= 0) {
                    res.send(JSON.stringify({information: 'User is Required to DM'}))
                    return
                } else if (dmUsername === null) {
                    res.send(JSON.stringify({information: 'User is Required to DM'}))
                    return
                } else if (dmUsername === undefined) {
                    res.send(JSON.stringify({information: 'User is Required to DM'}))
                    return
                } else {
                    let checkUserChats = JSON.parse(userData[0]['chats'])
                    let checkDmChat = JSON.parse(checkData[0]['chats'])['chats']
                    let chats = checkUserChats['chats']

                    let canDm = true
                    
                    if (chats === undefined || chats.length == 0) {
                        let user = checkData[0]['checkUsername']
                        let dmer = userData[0]['checkUsername']
                        let username = decode(checkData[0]['username'], key, iv)
                        let dmUsername = decode(userData[0]['username'], key, iv)
                        let randomStringHash = randomString(35)
                        let randomHash = hash(randomStringHash)
                        let chatName = username + ', ' + dmUsername

                        let userChats = JSON.parse(userData[0]['chats'])
                        userChats['chatCount'] = userChats['chatCount'] + 1
                        userChats['chats'].push(randomHash)

                        let dmChats = JSON.parse(checkData[0]['chats'])
                        dmChats['chatCount'] = dmChats['chatCount'] + 1
                        dmChats['chats'].push(randomHash)

                        await executeSQL("INSERT INTO Centri.chats (chatHash, chatName, chatUsers) VALUES ('" + randomHash + "', '" + chatName + "', '" + JSON.stringify({'chatUsers': [user, dmer]}) + "')")
                        await executeSQL("UPDATE Centri.accounting SET chats='" + JSON.stringify(userChats) + "' WHERE token='" + token + "'")
                        await executeSQL("UPDATE Centri.accounting SET chats='" + JSON.stringify(dmChats) + "' WHERE checkUsername='" + user + "'")

                        console.log('Sending [POST]: /api/createdm')
                        res.send(JSON.stringify({information: 'DM Created', dmHash: randomHash}))
                        return
                    } else {
                        chats.forEach(async function(chat){
                            if (checkDmChat.includes(chat) && canDm) {
                                canDm = false
                                res.send(JSON.stringify({information: 'DM Already Created'}))
                                return
                            } else if (canDm) {
                                let user = checkData[0]['checkUsername']
                                let dmer = userData[0]['checkUsername']
                                let username = decode(checkData[0]['username'], key, iv)
                                let dmUsername = decode(userData[0]['username'], key, iv)
                                let randomStringHash = randomString(35)
                                let randomHash = hash(randomStringHash)
                                let chatName = username + ', ' + dmUsername

                                let userChats = JSON.parse(userData[0]['chats'])
                                userChats['chatCount'] = userChats['chatCount'] + 1
                                userChats['chats'].push(randomHash)

                                let dmChats = JSON.parse(checkData[0]['chats'])
                                dmChats['chatCount'] = dmChats['chatCount'] + 1
                                dmChats['chats'].push(randomHash)

                                await executeSQL("INSERT INTO Centri.chats (chatHash, chatName, chatUsers) VALUES ('" + randomHash + "', '" + chatName + "', '" + JSON.stringify({'chatUsers': [user, dmer]}) + "')")
                                await executeSQL("UPDATE Centri.accounting SET chats='" + JSON.stringify(userChats) + "' WHERE token='" + token + "'")
                                await executeSQL("UPDATE Centri.accounting SET chats='" + JSON.stringify(dmChats) + "' WHERE checkUsername='" + user + "'")

                                console.log('Sending [POST]: /createdm')
                                res.send(JSON.stringify({information: 'DM Created', dmHash: randomHash}))
                                return
                            }
                        })
                    }
                }
            }
        }
    } else {
        res.redirect('/')
    }
})

app.post('/api/newsignin', async function(req, res){
    console.log('Sending [POST]: /api/newsignin')
    const jsonData = req.body
    let username = jsonData.username
    let password = jsonData.password
    let checkUsername = username.toLowerCase()
    let hashedPassword = hash(password)
    let hashedCheckUsername = hash(checkUsername)

    if (await checkCurrentUsername(hashedCheckUsername)) {
        let userdata = await executeSQL('SELECT * FROM Centri.accounting WHERE checkUsername = "' + hashedCheckUsername + '"')
        let databasePassword = userdata[0]['password']
        if (databasePassword == hashedPassword) {
            let token = userdata[0]['token']
            res.send(JSON.stringify({information: 'Signed In', token: token}))
            return
        } else {
            res.send(JSON.stringify({information: 'Incorrect Username or Password'}))
            return
        }
    } else {
        res.send(JSON.stringify({information: 'Incorrect Username or Password'}))
        return
    }
})

app.post('/api/newsignup', async function(req, res){
    console.log('Sending [POST]: /api/newsignup')
    const jsonData = req.body
    let username = jsonData.username
    let password = jsonData.password
    let checkUsername = username.toLowerCase()
    let hashedPassword = hash(password)
    let hashedCheckUsername = hash(checkUsername)
    let token = hashedCheckUsername+ '.' + hashedPassword
    let encodedUsername = encode(username, key, iv)

    if (checkUsername.length == 0) {
        res.send(JSON.stringify({information: 'A Username is Required'}))
        return
    }
    if (checkUsername != null && checkUsername.length < 20) {
        if (checkUsernameCharacters(checkUsername)) {
            if (password.length > 0) {
                if (await checkCurrentUsername(hashedCheckUsername) == false) {
                    await executeSQL("INSERT INTO Centri.accounting (username, checkUsername, password, token, status, chats) VALUES ('" + encodedUsername + "', '" + hashedCheckUsername + "', '" + hashedPassword + "', '" + token + "', 0, '" + JSON.stringify({"chatCount": 0, "chats": []}) + "');")
                    res.send(JSON.stringify({information: 'Signed Up', token: token}))
                    return
                } else {
                    res.send(JSON.stringify({information: 'Username is Already Taken'}))
                    return
                }
            } else {
                res.send(JSON.stringify({information: 'A Password is Required'}))
                return
            }
        } else {
            res.send(JSON.stringify({information: 'Username has Invalid Letters'}))
            return
        }
    } else {
        res.send(JSON.stringify({information: 'Username is Too Big'}))
        return
    }
})

app.post('/api/encode', async function(req, res){
    console.log('Sending [POST]: /api/encode')
    const token = req.cookies.token
    if (token) {
        const jsonData = req.body
        let text = jsonData.text

        const sqlCheck = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '";')
        if (sqlCheck[0] === null) {
            res.send(JSON.stringify({'information': 'Rejected'}))
            return 
        } else if (sqlCheck[0] === undefined) {
            res.send(JSON.stringify({'information': 'Rejected'}))
            return
        } else {
            const encrypted = encode(text, key, iv)
            res.send(JSON.stringify({'information': encrypted}))
            return
        }
    } else {
        res.send(JSON.stringify({'information': 'Rejected'}))
        return
    }
})

app.post('/api/deletemessage', async function(req, res){
    console.log('Sending [POST]: /api/deletemessage')
    const token = req.cookies.token
    if (token) {
        const jsonData = req.body
        let messageHash = jsonData.messageHash
        let chatHash = jsonData.chatHash

        const sqlCheck = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '"')

        if (sqlCheck[0] === null) {
            res.send(JSON.stringify({'information': 'Rejected Token'}))
            return 
        } else if (sqlCheck[0] === undefined) {
            res.send(JSON.stringify({'information': 'Rejected Token'}))
            return
        } else {
            const chats = JSON.parse(sqlCheck[0]['chats'])['chats']
            if (chats.includes(chatHash)) {
                const message = await executeSQL('SELECT * FROM Centri.messages WHERE messageHash="' + messageHash + '"')
                if (message[0] === null) {
                    res.send(JSON.stringify({'information': 'Rejected Message'}))
                    return 
                } else if (message[0] === undefined) {
                    res.send(JSON.stringify({'information': 'Rejected Message'}))
                    return
                } else {
                    if (message[0]['messageType'] == 1) {
                        await executeSQL('DELETE FROM Centri.messages WHERE messageHash="' + messageHash + '"')
                        io.emit('deleteMessage', JSON.stringify({'chatHash': chatHash, 'messageHash': messageHash}))
                        res.send(JSON.stringify({'information': 'Deletion Success'}))
                        return
                    } else if (message[0]['messageType'] == 2) {
                        const messageData = await executeSQL('SELECT  * FROM Centri.messages WHERE messageHash="' + messageHash + '"')
                        const imageHash = messageData[0]['messageContent']
                        await executeSQL('DELETE FROM Centri.messages WHERE messageHash="' + messageHash + '"')
                        await executeSQL('DELETE FROM Centri.media WHERE mediaHash="' + imageHash + '"')
                        io.emit('deleteMessage', JSON.stringify({'chatHash': chatHash, 'messageHash': messageHash}))
                        res.send(JSON.stringify({'information': 'Deletion Success'}))
                        return
                    }
                }
            } else {
                res.send(JSON.stringify({'information': 'Unauthorized Request'}))
                return
            }
        }
    } else {
        res.send(JSON.stringify({'information': 'Rejected Token'}))
        return
    }
})

app.post('/api/getmessage', async function(req, res){
    console.log('Sending [POST]: /api/getmessage')
    const token = req.cookies.token
    if (token) {
        const jsonData = req.body
        let chatHash = jsonData.chatHash
        let messageHash = jsonData.messageHash

        const sqlCheck = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '";')
        if (sqlCheck[0] === null) {
            res.send(JSON.stringify({'information': 'Rejected Token'}))
            return 
        } else if (sqlCheck[0] === undefined) {
            res.send(JSON.stringify({'information': 'Rejected Token'}))
            return
        } else {
            const chats = JSON.parse(sqlCheck[0]['chats'])['chats']
            if (chats.includes(chatHash)) {
                let messageString = ''
                let canDelete = ''

                const messageData = await executeSQL('SELECT * FROM Centri.messages WHERE messageHash="' + messageHash + '"')
                let messageSender = messageData[0]['messageSender']
                let messageType = messageData[0]['messageType']

                if (sqlCheck[0]['checkUsername'] == messageSender) {
                    canDelete = '<input type="button" value="Delete Message" id="deleteMessage" class="deleteMessage" onclick="deleteMessage(`' + messageHash + '`)">'
                }
                if (messageType == 1) {
                    let messageContent = decode(messageData[0]['messageContent'], key, iv)
                    let username = decode(messageData[0]['messageUser'], key, iv)

                    messageString += '<div class="message" id="' + messageHash + '"><span class="username" id="username">' + username + ':</span> <span class="messageData">' + messageContent + '</span> ' + canDelete + '</div>'
                } else if (messageType == 2) {
                    let messageDat = messageData[0]['messageContent']
                    let username = decode(messageData[0]['messageUser'], key, iv)

                    messageString += '<div class="message" id="' + messageHash + '"><span class="username" id="username">' + username + ':</span> <a href="" id="a-' + messageDat + '" target="_blank"><img class="sentMedia" src="" onerror="loadMedia(`' + messageDat + '`)" id="' + messageDat + '"></a> ' + canDelete + '</div>'
                }

                res.send(JSON.stringify({'information': messageString}))
                return
            } else {
                res.send(JSON.stringify({'information': 'Invalid Chat'}))
                return
            }
        }
    } else {
        res.send(JSON.stringify({'information': 'Rejected'}))
        return
    }
})

app.use((req, res) => {
    let page = req.url
    res.status(404).render('404', {page: page}) 
})

io.on('connection', async function(socket){
    socket.on('newMessage', async function(messageDetails){
        const jsonData = JSON.parse(messageDetails)
        let message = decode(jsonData.message, key, iv)
        let chatHash = jsonData.chatHash
        let token = jsonData.token

        if (token) {
            const sqlCheck = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '";')
            if (sqlCheck[0] === null) {
                return
            } else if (sqlCheck[0] === undefined) {
                return
            } else {
                if (checkCharacters(message)) {
                    if (message.length > 0 && message != '') {
                        let randomStringHash = randomString(35)
                        let randomHash = hash(randomStringHash)
                        let messageContent = encode(message, key, iv)
                        let messageSender = sqlCheck[0]['checkUsername']
                        let messageUser = sqlCheck[0]['username']
                        let seconds = new Date().getTime() / 1000

                        await executeSQL('INSERT INTO Centri.messages (messageHash, messageContent, messageSender, messageType, chat, messageUser, sendingTime) VALUES ("' + randomHash + '", "' + messageContent + '", "' + messageSender + '", 1, "' + chatHash + '", "' + messageUser + '", ' + seconds + ')')
                        io.emit('callMessage', JSON.stringify({'chat': chatHash, 'messageHash': randomHash}))
                        return
                    }
                }
            }
        } else {
            return
        }
    })

    socket.on('newFile', async function(fileDetails) {
        const jsonData = JSON.parse(fileDetails)
        let fileData = jsonData.fileData
        let chatHash = jsonData.chatHash
        let token = jsonData.token

        if (token) {
            const sqlCheck = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '";')
            if (sqlCheck[0] === null) {
                return
            } else if (sqlCheck[0] === undefined) {
                return
            } else {
                let randomStringHash = randomString(35)
                let randomHash = hash(randomStringHash)
                let mediaRandomStringHash = randomString(35)
                let mediaRandomHash = hash(mediaRandomStringHash)
                let messageSender = sqlCheck[0]['checkUsername']
                let messageUser = sqlCheck[0]['username']
                let seconds = new Date().getTime() / 1000

                await executeSQL('INSERT INTO Centri.messages (messageHash, messageContent, messageSender, messageType, chat, messageUser, sendingTime) VALUES ("' + randomHash + '", "' + mediaRandomHash + '", "' + messageSender + '", 2, "' + chatHash + '", "' + messageUser + '", ' + seconds + ')')
                await executeSQL('INSERT INTO Centri.media (mediaHash, mediaSender, media) VALUES ("' + mediaRandomHash + '", "' + messageSender + '", "' + fileData + '")')
                io.emit('callMessage', JSON.stringify({'chat': chatHash, 'messageHash': randomHash}))
                return
            }
        } else {
            return
        }
    })
})

server.listen(3000, () => {
  console.log('Centri started on port 3000. https://127.0.0.1:3000/')
})