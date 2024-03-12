const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const jwtToken = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const path = require('path')

const app = express()
app.use(express.json())
const filepath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const startserver = async () => {
  try {
    db = await open({
      filename: filepath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server started on http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error ${e.message}`)
    process.exit(1)
  }
}
startserver()

//tokenverify
const authenticatetoken = (request, response, next) => {
  let token
  const authtoken = request.headers['authorization']
  if (authtoken !== undefined) {
    token = authtoken.split(' ')[1]
  }
  if (token === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwtToken.verify(token, 'Hirahul', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//loginuser
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userquery = `select * from user where username = '${username}'`
  const dbresponse = await db.get(userquery)
  if (dbresponse === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isitcorrectpassword = await bcrypt.compare(
      password,
      dbresponse.password,
    )
    if (isitcorrectpassword !== true) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {
        username: username,
      }
      const jwt = jwtToken.sign(payload, 'Hirahul')
      response.send({jwt})
    }
  }
})

//listofstates
app.get('/states/', authenticatetoken, async (request, response) => {
  const statequery = `SELECT * FROM state`
  const dbresponse = await db.all(statequery)
  const details = dbresponse.map(each => {
    return {
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    }
  })
  response.send(details)
})

//singlestate
app.get('/states/:stateId/', authenticatetoken, async (request, response) => {
  const {stateId} = request.params
  const statequery = `SELECT * FROM state WHERE state_id = ${stateId}`
  const dbresponse = await db.all(statequery)
  dbresponse.map(each => {
    response.send({
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    })
  })
})
//addDistrict
app.post('/districts/', authenticatetoken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const query = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths})`
  await db.run(query)
  response.send('District Successfully Added')
})

//getoneDistrict
app.get(
  '/districts/:districtId/',
  authenticatetoken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `SELECT * FROM district WHERE district_id = ${districtId}`
    const dbresponse = await db.all(query)
    dbresponse.map(each => {
      response.send({
        districtId: each.district_id,
        districtName: each.district_name,
        stateId: each.state_id,
        cases: each.cases,
        cured: each.cured,
        active: each.active,
        deaths: each.deaths,
      })
    })
  },
)

//deleteDistrict
app.delete(
  '/districts/:districtId/',
  authenticatetoken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `DELETE FROM district WHERE district_id = ${districtId}`
    await db.run(query)
    response.send('District Removed')
  },
)

//updateDistrictwithId
app.put(
  '/districts/:districtId/',
  authenticatetoken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const query = `UPDATE  district
      SET 
        district_name= '${districtName}',
        state_id= ${stateId},
        cases= ${cases},
        cured= ${cured},
        active= ${active},
        deaths= ${deaths}
     WHERE district_id = ${districtId}`
    await db.run(query)
    response.send('District Details Updated')
  },
)

//countofCases,active,cured,deaths
app.get(
  '/states/:stateId/stats/',
  authenticatetoken,
  async (request, response) => {
    const {stateId} = request.params
    const query = `
  select 
  sum(cases) as totalCases,
  sum(cured) as totalCured,
   sum(active) as totalActive,
  sum(deaths) as totalDeaths
  from district
  WHERE state_id = ${stateId}`
    const dbresponse = await db.all(query)
    dbresponse.map(each => {
      response.send(each)
    })
  },
)

module.exports = app
