const express = require('express')
const path = require('node:path')
const bodyParser = require('body-parser');
const app = express()
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const dotenv = require('dotenv');
const mysql = require('mysql');
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

app.get('/', async function(req, res){

})

server.listen(3000, () => {
  console.log('092Chat started on port 3000. https://127.0.0.1:3000/')
})