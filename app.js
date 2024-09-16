const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require('./models/review'); 
const User = require("./models/user.js");
const passport = require("passport");
const localStrategy = require("passport-local");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/wanderlust")
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// Setup session
app.use(session({
  secret: "mysecretkey",
  resave: false,
  saveUninitialized: false,
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Routes
app.get("/", (req, res) => {
  res.redirect("/listings");  
});

// Listings Routes
app.get("/:listings", async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings, user: req.user });
});

app.get("/listings/new", (req, res) => {
  res.render("listings/new.ejs");
});

app.get("/listings/:id", async (req, res) => {
  try {
    let { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid listing ID");
    }
    const listing = await Listing.findById(id).populate("reviews");
    if (!listing) {
      return res.status(404).send("Listing not found");
    }
    res.render("listings/show.ejs", { listing, user: req.user });
  } catch (err) {
    console.error("Error fetching listing:", err);
    res.status(500).send("Error fetching listing");
  }
});

app.post("/listings", async (req, res) => {
  try {
    const newListing = new Listing(req.body.listing);
    let result = listingSchema.validate(req.body);
    if (result.error) {
      console.log("schema validation failed");
      return res.status(500).send("Wrong input");
    }
    await newListing.save();
    res.redirect("/listings");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while creating the listing.");
  }
});

app.get("/listings/:id/edit", async (req, res) => {
  try {
    let { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid listing ID");
    }
    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).send("Listing not found");
    }
    res.render("listings/edit.ejs", { listing });
  } catch (err) {
    console.error("Error fetching listing for edit:", err);
    res.status(500).send("Error fetching listing for edit");
  }
});

app.put("/listings/:id", async (req, res) => {
  try {
    let { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid listing ID");
    }
    let result = listingSchema.validate(req.body);
    if (result.error) {
      console.log("schema validation failed");
      return res.status(500).send("Wrong input");
    }
    await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.error("Error updating listing:", err);
    res.status(500).send("Error updating listing");
  }
});

app.delete("/listings/:id", async (req, res) => {
  try {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    res.redirect("/listings");
  } catch (err) {
    console.error("Error deleting listing:", err);
    res.status(500).send("Error deleting listing");
  }
});

app.post("/listings/:id/reviews", async (req, res) => {
  try {
    let id = req.params.id;
    let newReview = new Review(req.body.review);
    const listing = await Listing.findById(id);
    let result = reviewSchema.validate(req.body);
    if (result.error) {
      console.log("Schema validation failed");
      return res.status(400).send("Invalid input data");
    }
    listing.reviews.push(newReview);
    await listing.save();
    await newReview.save();
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.error("Error creating review:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.delete("/listings/:id/reviews/:reviewId", async (req, res) => {
  try {
    let { id, reviewId } = req.params;
    if (!mongoose.isValidObjectId(reviewId)) {
      return res.status(400).send("Invalid review ID");
    }
    await Review.findByIdAndDelete(reviewId);
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.error("Error deleting review:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/listings",
  failureRedirect: "/login",
}));

app.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

app.post("/signup", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUser = new User({ 
      username: req.body.username, 
      email: req.body.email,
      password: hashedPassword 
    });
    await newUser.save();
    res.redirect("/listings");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while signing up.");
  }
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/listings");
});

app.get("/*", (req, res) => {
  res.send("Wrong url");
});

// Start the server
app.listen(8080, () => {
  console.log("Port 8080 is listening");
});
