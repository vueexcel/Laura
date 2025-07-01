const User = require("../schemas/User");
const { getStartAndEndDates } = require('../middleware/common');
const { worldFoodApi, openaiLogMeal, openaiGenerateRecipe } = require("./groqHelper");
const mongoose = require("mongoose");

const GetHomeHelper = async (user_id, user) => {
  try {
    const timezone = user.timezone;
    // const { start_date, end_date } = getStartAndEndDates(new Date());
    const { start_date, end_date } = getStartAndEndDates(new Date(), "daily", timezone)
    const mealLogsData = await MealLogs.aggregate([
      {
        $match: { "user_id": user_id } // Flatten the consumed_log array
      },
      {
        $unwind: "$preferences.consumed_log" // Flatten the consumed_log array
      },
      {
        '$match': {
          'preferences.consumed_log.createdAt': {
            '$gte': new Date(start_date),
            '$lte': new Date(end_date)
          }
        }
      },
      {
        $group: {
          _id: null, // Single group for overall averages
          avgHealthScore: { $avg: "$preferences.consumed_log.health_score" }, // Average health score
          avgNutritionScore: {
            $avg: {
              $divide: [
                {
                  $add: [
                    "$preferences.consumed_log.fat",
                    "$preferences.consumed_log.carbs",
                    "$preferences.consumed_log.protein"
                  ]
                },
                3 // Divide by 3 to get the average of fat, carbs, and protein
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0, // Exclude the _id field from the result
          avgHealthScore: 1,
          avgNutritionScore: 1
        }
      }
    ]);
    if (!mealLogsData.length) {
      return {
        avgHealthScore: 0,
        avgNutritionScore: 0
      }
    } else {
      return mealLogsData[0];
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

const Home = async (user_id) => {
  try {
    const { getProfile } = require("./UserHelper");
    const profile = await getProfile(user_id)
    const homedata = await GetHomeHelper(user_id, profile);
    return {
      user_profile: profile,
    }
  } catch (error) {
    throw new Error(error.message);
  }
}





module.exports = { Home };
