const express = require("express")
const mongoose = require("mongoose")
const bodyParser = require("body-parser")
const session = require("express-session")

const app = express()

// ================= MIDDLEWARE =================

app.use(bodyParser.json())
app.use(express.static("public"))

// ✅ FIXED SESSION FOR RENDER
app.set('trust proxy', 1)

app.use(session({
  secret: "secretkey",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false
  }
}))

// ================= DATABASE =================

// ✅ USE ENV VARIABLE (RENDER)
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("DB Error:", err))

// ================= SCHEMAS =================

const DataSchema = new mongoose.Schema({
  date: String,
  driverName: String,
  carNumber: String,
  driverTrips: Number,
  driverEarning: Number,
  userId: String
})

const DriverSchema = new mongoose.Schema({
  name: String,
  phone: String,
  license: String,
  aadhar: String,
  dateJoined: String,
  userId: String
})

const UserSchema = new mongoose.Schema({
  username: String,
  password: String
})

const Data = mongoose.model("Data", DataSchema)
const Driver = mongoose.model("Driver", DriverSchema)
const User = mongoose.model("User", UserSchema)

// ================= AUTH =================

function checkAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized")
  }
  next()
}

app.post("/register", async (req, res) => {
  const { username, password } = req.body

  const existing = await User.findOne({ username })
  if (existing) return res.send("User exists")

  await User.create({ username, password })
  res.send("Registered")
})

app.post("/login", async (req, res) => {
  const { username, password } = req.body

  const user = await User.findOne({ username, password })
  if (!user) return res.json({ status: "fail" })

  req.session.userId = user._id
  req.session.username = user.username

  res.json({ status: "success", username: user.username })
})

app.get("/logout", (req, res) => {
  req.session.destroy()
  res.send("Logged out")
})

// ================= DRIVER =================

app.post("/addDriver", checkAuth, async (req, res) => {

  const existing = await Driver.findOne({
    name: req.body.name,
    userId: req.session.userId
  })

  if (existing) return res.send("Driver already exists")

  await Driver.create({
    ...req.body,
    userId: req.session.userId
  })

  res.send("Driver Saved")
})

app.get("/drivers", checkAuth, async (req, res) => {
  const data = await Driver.find({ userId: req.session.userId })
  res.json(data)
})

app.delete("/deleteDriver/:id", checkAuth, async (req, res) => {
  await Driver.findByIdAndDelete(req.params.id)
  res.send("Deleted")
})

// ================= ENTRY =================

app.post("/add", checkAuth, async (req, res) => {

  const { date, driverName, carNumber } = req.body

  const existing = await Data.findOne({
    date,
    driverName,
    carNumber,
    userId: req.session.userId
  })

  if (existing) return res.send("Duplicate Entry Not Allowed")

  await Data.create({
    ...req.body,
    userId: req.session.userId
  })

  res.send("Saved")
})

app.get("/data", checkAuth, async (req, res) => {
  const data = await Data.find({ userId: req.session.userId })
  res.json(data)
})

app.put("/update/:id", checkAuth, async (req, res) => {
  await Data.findByIdAndUpdate(req.params.id, req.body)
  res.send("Updated")
})

app.delete("/delete/:id", checkAuth, async (req, res) => {
  await Data.findByIdAndDelete(req.params.id)
  res.send("Deleted")
})

// ================= TOTALS =================

app.get("/totals", checkAuth, async (req, res) => {

  const data = await Data.find({ userId: req.session.userId })

  let today = 0, week = 0, month = 0
  const now = new Date()

  data.forEach(d => {
    const entry = new Date(d.date)

    if (entry.toDateString() === now.toDateString())
      today += Number(d.driverEarning)

    if ((now - entry) / (1000 * 60 * 60 * 24) <= 7)
      week += Number(d.driverEarning)

    if (entry.getMonth() === now.getMonth())
      month += Number(d.driverEarning)
  })

  res.json({ today, week, month })
})

// ================= COMPARISON =================

app.get("/comparison", checkAuth, async (req, res) => {

  const data = await Data.find({ userId: req.session.userId })

  let today = 0, yesterday = 0, week = 0
  const now = new Date()

  data.forEach(d => {
    const entry = new Date(d.date)

    if (entry.toDateString() === now.toDateString())
      today += Number(d.driverEarning)

    let y = new Date()
    y.setDate(now.getDate() - 1)

    if (entry.toDateString() === y.toDateString())
      yesterday += Number(d.driverEarning)

    if ((now - entry) / (1000 * 60 * 60 * 24) <= 7)
      week += Number(d.driverEarning)
  })

  res.json({ today, yesterday, week })
})

// ================= SERVER =================

// ✅ RENDER PORT FIX
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server running on port " + PORT)
})