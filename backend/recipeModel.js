const mongoose = require('mongoose');
const { Schema } = mongoose;

const userRecipeSchema = new Schema({
    userId: {
        type: String
    },
    recipeId: {
      type: String,
      unique: true
  },
    name: {
      type: String,
      required: true

    },
    description: {
      type: String,
      required: true

    },
    ingredients: {
        type: Schema.Types.Mixed,
      required: true

    },

    instructions: { 
        type: Schema.Types.Mixed,
        required: true 
    },
    
    image: {
        type: Schema.Types.Mixed,
      
    },
    author: {
      type: String,
      
    },
    isFavorite: {
      type: Boolean,
    },
    yield: {
      type: String,
    
    },
    times: {
      cook: {
        hours: {
          type: Number,
          
          default: 0,
        },
        minutes: {
          type: Number,
          
          default: 0,
        },
      },
      prep: {
        hours: {
          type: Number,
          
          default: 0,
        },
        minutes: {
          type: Number,
          
          default: 0,
        },
      },
      total: {
        hours: {
          type: Number,
          
          default: 0,
        },
        minutes: {
          type: Number,
          
          default: 0,
        },
      },
    },
  }, {strict: false});

const Recipe = mongoose.model('Recipes', userRecipeSchema);


module.exports = Recipe;