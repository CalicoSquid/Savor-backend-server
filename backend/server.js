const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const Recipe = require('./recipeModel');
const User = require('./userModel');
const sharp = require('sharp');
const app = express();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path'); // Import the 'path' module
const port = 8000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
require("dotenv").config();
const secretKey = "savortheflavor";



app.post('/api/convert-to-png', async (req, res) => {
  const { imageUrl } = req.body;

  try {
    // Download the image from the provided URL and save it to a local file
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const tempImagePath = path.join(__dirname, 'temp', `temp_image.jpg`); // Use path.join
    await fs.writeFile(tempImagePath, imageResponse.data);

    // Load the downloaded image and convert to PNG
    const convertedImageBuffer = await sharp(tempImagePath).toFormat('png').toBuffer();

    // Send the converted image back to the client
    res.type('png').send(convertedImageBuffer);
  } catch (error) {
    console.error('Conversion failed:', error);
    res.status(500).json({ error: 'Conversion failed' });
  }
});



// Middleware function to authenticate token
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.sendStatus(403)
    };
    req.user = user;
    next();
  });
};

// Middleware to allow cross-origin requests (CORS)
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  next();
});


// Route to get user data
app.get("/api/user-data", authenticateToken, async (req, res) => {
  // Get the user ID from the authenticated token
  const userId = req.user.userId;

  try {
    // Fetch user data based on the user ID
    const userData = await User.findById(userId);
    res.json(userData);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// Route to register a new user
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;

  try {
    // Check if the username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    // Hash the password before storing it in the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user instance with the provided data and save it to the database
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

// Route to handle user login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user with the provided username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare the provided password with the hashed password stored in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate a JWT token for authentication
    const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to log in' });
  }
});

// Route to scrape recipe data from a given URL
app.post('/api/scrape', async (req, res) => {
  try {
    const url = req.body.url;
    const recipeData = await scrapeRecipe(url);
    res.json(recipeData);
  } catch (error) {
    console.error('Error scraping recipe:', error);
    res.status(500).json({ error: 'Error scraping recipe' });
  }
});

// Function to scrape recipe data from a given URL
async function scrapeRecipe(url) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Extract recipe data from the HTML using Cheerio
  const script = $("script[type=application/ld+json]").html();
  const img = $("img")
  console.log(img)
  const recipeData = JSON.parse(script);

  return recipeData;
}

// Route to save a recipe to the database
app.post('/api/save-recipe', async (req, res) => {
  // Extract recipe data from the request body
  const { recipeId, userId, name, description, ingredients, instructions, image, author, isFavorite, recipeYield, times } = req.body;

  try {
    // Create a new recipe instance with the provided data and save it to the database
    const existingRecipe = await Recipe.findOne({ userId, name });

    if (existingRecipe) {
      return res.status(400).json({ success: false, message: 'Recipe with the same name already exists' });
    }


    const newRecipe = new Recipe({
      userId,
      recipeId,
      name,
      description,
      ingredients,
      instructions,
      image,
      isFavorite,
      author,
      recipeYield,
      times
    });

    await newRecipe.save();
    res.json({ success: true, message: 'Recipe saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to save recipe' });
  }
});

// Route to get all recipes for a specific user
app.get('/api/recipes/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Find all recipes associated with the provided user ID
    const recipes = await Recipe.find({ userId });
    res.json({ success: true, recipes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch recipes' });
  }
});

// Route to delete a recipe from the database
app.delete('/api/recipes/:recipeId', async (req, res) => {
  const recipeId = req.params.recipeId;

  try {
    // Find and delete the recipe with the provided name (recipeId)
    const recipe = await Recipe.findOneAndDelete({ recipeId: recipeId });

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ success: true, message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to delete recipe' });
  }
});

app.put('/api/recipes/:recipeId', async (req, res) => {

  const recipeId = req.params.recipeId;
  const {
    userId,
    name,
    description,
    ingredients,
    instructions,
    image,
    author,
    isFavorite,
    recipeYield,
    times
  } = req.body;

  try {
    const updatedRecipe = await Recipe.findOneAndUpdate(
      { recipeId, userId }, // Find the recipe by both recipeId and userId
      {
        name,
        description,
        ingredients,
        instructions,
        image,
        author,
        isFavorite,
        recipeYield,
        times
      },
      { new: true } // Return the updated recipe
    );

    if (!updatedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ success: true, message: 'Recipe updated successfully', updatedRecipe });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update recipe' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});