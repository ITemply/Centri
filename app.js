const express = require('express')
const path = require('node:path')
const bodyParser = require('body-parser')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const dotenv = require('dotenv')
const mysql = require('mysql')
const crypto = require('crypto');
const cookieParser = require('cookie-parser')
dotenv.config()

// 3 = Owner
// 2 = Admin
// 1 = Moderator

app.set('views', path.join(__dirname, 'public'))
app.use('/images', express.static('images'));
app.set('view engine', 'ejs')
app.use(express.json())
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

async function executeSQL(sql){
  let connection = mysql.createConnection({
      host: databaseUrl,
      user: username,
      password: password,
      port: port
  })

  return new Promise((resolve, reject) =>{
      try{
          connection.query(sql, function (err, result) {
              if (err){
                  return reject(err)
              }
              connection.end()
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

function encode(text) {
    let base = btoa(text)
    let cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(base)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return encrypted.toString('hex')
 }

function decode(text) {
    let encryptedText = Buffer.from(text, 'hex')
    let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
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

        let htmlChats = ''

        for (const chatInt in chats['chats']) {
            let currentChat = await executeSQL('SELECT * FROM Centri.chats WHERE chatHash ="' + chats['chats'][chatInt] + '"')
            htmlChats += '<div class="chat"><span class="chatName">' + currentChat[0]['chatName'] + '</span><br><input type="button" value="Open Chat" class="chatButton" onclick="openChat(`' + chats['chats'][chatInt] + '`)"></div>'
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
    res.redirect('/home?backType=2')
})

app.get('/chat/:chatHash', async function(req, res){
    const token = req.cookies.token
    if (token) {
        const userData = await executeSQL('SELECT * FROM Centri.accounting WHERE token="' + token + '"')
        const chatHash = req.params.chatHash
        const userChats = JSON.parse(userData[0]['chats'])

        for (const chatInt in userChats['chats']) {
            if (userChats['chats'][chatInt] == chatHash) {
                console.log('Sending [GET]: /chat')
                res.render('chat', {})
                return
            }
        }
        res.redirect('/home?backType=1')
    } else {
        res.redirect('/')
    }
})

app.post('/createdm', async function(req, res) {
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
                        let username = decode(checkData[0]['username'], key)
                        let dmUsername = decode(userData[0]['username'], key)
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
                    } else {
                        chats.forEach(async function(chat){
                            if (checkDmChat.includes(chat) && canDm) {
                                canDm = false
                                res.send(JSON.stringify({information: 'DM Already Created'}))
                                return
                            } else if (canDm) {
                                let user = checkData[0]['checkUsername']
                                let dmer = userData[0]['checkUsername']
                                let username = decode(checkData[0]['username'], key)
                                let dmUsername = decode(userData[0]['username'], key)
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

app.post('/newsignin', async function(req, res){
    console.log('Sending [POST]: /newsignin')
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

app.post('/newsignup', async function(req, res){
    console.log('Sending [POST]: /newsignup')
    const jsonData = req.body
    let username = jsonData.username
    let password = jsonData.password
    let checkUsername = username.toLowerCase()
    let hashedPassword = hash(password)
    let hashedCheckUsername = hash(checkUsername)
    let token = hashedCheckUsername+ '.' + hashedPassword
    let encodedUsername = encode(username, key)

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

app.use((req, res) => {
    let page = req.url
    res.status(404).render('404', {page: page}) 
}) 

server.listen(3000, () => {
  console.log('Centri started on port 3000. https://127.0.0.1:3000/')
})