const express = require("express")
const mongoose = require("mongoose")
const session = require("express-session")
require("dotenv").config()

const app = express()

// ===== MIDDLEWARE =====
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

// ===== DATABASE =====
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err))

// ===== SESSION =====
app.use(session({
  secret: "secretkey",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}))

// ===== SCHEMAS =====
const Data = mongoose.model("Data", new mongoose.Schema({
  date:String,
  driverName:String,
  carNumber:String,
  driverTrips:Number,
  driverEarning:Number,
  userId:String
}))

const Driver = mongoose.model("Driver", new mongoose.Schema({
  name:String,
  phone:String,
  license:String,
  aadhar:String,
  dateJoined:String,
  userId:String
}))

const User = mongoose.model("User", new mongoose.Schema({
  username:String,
  password:String
}))

// ===== AUTH MIDDLEWARE =====
function checkAuth(req,res,next){
  if(!req.session.userId){
    return res.status(401).send("Unauthorized")
  }
  next()
}

// ===== REGISTER =====
app.post("/register", async (req,res)=>{
  try{
    const {username,password} = req.body

    if(!username || !password){
      return res.status(400).send("Fill all fields")
    }

    const existing = await User.findOne({username})
    if(existing) return res.send("User already exists")

    await User.create({username,password})
    res.send("Registered Successfully")

  }catch(err){
    console.log(err)
    res.status(500).send("Server Error")
  }
})

// ===== LOGIN =====
app.post("/login", async (req,res)=>{
  try{

    console.log("Login Data:", req.body)

    const {username,password} = req.body

    if(!username || !password){
      return res.status(400).send("Missing fields")
    }

    const user = await User.findOne({username,password})

    if(!user){
      return res.json({status:"fail"})
    }

    req.session.userId = user._id

    res.json({
      status:"success",
      username:user.username
    })

  }catch(err){
    console.log("LOGIN ERROR:", err)
    res.status(500).send("Server Error")
  }
})

// ===== LOGOUT =====
app.get("/logout",(req,res)=>{
  req.session.destroy(()=>{
    res.send("Logged out")
  })
})

// ===== DRIVER =====
app.post("/addDriver",checkAuth,async(req,res)=>{
  try{
    const existing = await Driver.findOne({
      name:req.body.name,
      userId:req.session.userId
    })

    if(existing) return res.send("Driver already exists")

    await Driver.create({...req.body,userId:req.session.userId})
    res.send("Driver Saved")

  }catch(err){
    res.status(500).send("Error")
  }
})

app.get("/drivers",checkAuth,async(req,res)=>{
  const data = await Driver.find({userId:req.session.userId})
  res.json(data)
})

app.delete("/deleteDriver/:id",checkAuth,async(req,res)=>{
  await Driver.findByIdAndDelete(req.params.id)
  res.send("Deleted")
})

// ===== ENTRY =====
app.post("/add",checkAuth,async(req,res)=>{
  try{

    const {date,driverName,carNumber} = req.body

    const existing = await Data.findOne({
      date,driverName,carNumber,userId:req.session.userId
    })

    if(existing) return res.send("Duplicate Entry Not Allowed")

    await Data.create({...req.body,userId:req.session.userId})
    res.send("Saved")

  }catch(err){
    res.status(500).send("Error")
  }
})

app.get("/data",checkAuth,async(req,res)=>{
  const data = await Data.find({userId:req.session.userId})
  res.json(data)
})

app.put("/update/:id",checkAuth,async(req,res)=>{
  await Data.findByIdAndUpdate(req.params.id,req.body)
  res.send("Updated")
})

app.delete("/delete/:id",checkAuth,async(req,res)=>{
  await Data.findByIdAndDelete(req.params.id)
  res.send("Deleted")
})

// ===== TOTALS =====
app.get("/totals",checkAuth,async(req,res)=>{
  const data = await Data.find({userId:req.session.userId})

  let today=0,week=0,month=0
  const now = new Date()

  data.forEach(d=>{
    const entry = new Date(d.date)

    if(entry.toDateString()===now.toDateString())
      today+=Number(d.driverEarning)

    if((now-entry)/(1000*60*60*24)<=7)
      week+=Number(d.driverEarning)

    if(entry.getMonth()===now.getMonth())
      month+=Number(d.driverEarning)
  })

  res.json({today,week,month})
})

// ===== SERVER =====
const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
  console.log("Server running on port "+PORT)
})