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

function encode(text, algkey) {
    const cipher = crypto.createCipher(algorithm, algkey)  
    const  encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
    return encrypted
}

function decode(text, algkey) {
    const  decipher = crypto.createDecipher(algorithm, algkey)
    const decrypted = decipher.update(text, 'hex', 'utf8') + decipher.final('utf8')
    return decrypted
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
    console.log('Sending [GET]: /home')
    res.render('home')
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

app.post('/newsignin', async function(req, res){
    console.log('Sending [POST]: New Sign Up')
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
    console.log('Sending [POST]: New Sign Up')
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
                    await executeSQL("INSERT INTO Centri.accounting (username, checkUsername, password, token, status) VALUES ('" + encodedUsername + "', '" + hashedCheckUsername + "', '" + hashedPassword + "', '" + token + "', 0);")
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
    res.status(404).send(
        '<center><br><span style="font-family: Arial; font-size: 24px;">Looked it up, <b>' + page + '</b> was not found. <br><br> <span style="font-size: 18px;"><b>Error 404</b>: Not Found</span></span><br><img style="padding-top: 150px;" src="https://media1.tenor.com/m/QQiopAKBLyUAAAAd/miber.gif"></center>'
    ) 
}) 

server.listen(3000, () => {
  console.log('Centri started on port 3000. https://127.0.0.1:3000/')
})