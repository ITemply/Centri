const express = require('express')
const path = require('node:path')
const bodyParser = require('body-parser')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const dotenv = require('dotenv')
const mysql = require('mysql')
dotenv.config()

app.set('views', path.join(__dirname, 'public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))

const databaseUrl = process.env.DATABASE_URL
const username = process.env.USERNAME
const password = process.env.PASSWORD
const port = process.env.PORT

const algorithm = process.env.ALG
const key = process.env.KEY

const validChars = process.env.VALID_CHARS
const validUsernameChars = process.env.VALID_UNAME_CHARS

async function executeSQL(sql){
  var connection = mysql.createConnection({
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
    return createHash('sha256').update(string).digest('hex')
}

function base64Image(file){
    return fs.readFileSync(file, 'base64')
}

function checkUserane(inputString) {
    const characterList = new RegExp(`[^${validUsernameChars}]`, 'g')
    return !characterList.test(inputString)
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

function checkCharacters(inputString) {
    const characterList = new RegExp(`[^${validChars}]`, 'g')
    return !characterList.test(inputString)
}

app.get('/', async function(req, res){
    console.log('Sending [GET]: /')
    console.log(await executeSQL('SHOW TABLES IN Centri;'))
    res.render('index')
})

app.post('/newsignup', async function(req, res){
    console.log('Sending [POST]: New Sign Up')
    const jsonData = req.body
    let username = jsonData.username
    let password = jsonData.password
    let checkUsername = username.toLowerCase()
    let hashedPassword = hash(password)
    let hashedCheckUsername = hash(checkUsername)
    let token = hashedCheckUsername+ '.' + newPassword
    let encodedUsername = encode(username, key)

    if (await checkCurrentUsername(hashedCheckUsername)) {
        if (checkUsername.length == 0) {
            res.send(JSON.stringify({information: 'A Username Is Required'}))
            return
        }
        if (checkUsername != null && checkUsername.length < 20) {
            if (checkCharacters(checkUsername)) {
                if (password.length > 0) {
                    await executeSQL("INSERT INTO accounting (username, checkUsername, password, token, status) VALUES ('" + encodedUsername + "', '" + hashedCheckUsername + "', '" + hashedPassword + "', '" + token + "', 0);")
                    res.send(JSON.stringify({information: 'Signed Up', token: token}))
                    return
                } else {
                    res.send(JSON.stringify({information: 'A Password Is Required'}))
                    return
                }
            } else {
                res.send(JSON.stringify({information: 'User Has Invalid Letters'}))
                return
            }
        } else {
            res.send(JSON.stringify({information: 'User Is Too Big'}))
            return
        }
    } else {
        res.send(JSON.stringify({information: 'User Already Taken'}))
        return
    }
})

server.listen(3000, () => {
  console.log('Centri started on port 3000. https://127.0.0.1:3000/')
})