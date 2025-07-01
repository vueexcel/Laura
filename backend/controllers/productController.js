const asyncHandler = require("express-async-handler");
const {
  returnResponse,
  verifyrequiredparams,
} = require("../middleware/common");
const {  Home } = require("../helpers/productHelper");
const { groq, openaiLogMeal } = require('../helpers/groqHelper');




const GroqChat = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    const user_id = req.user?._id;
    const id = req.params.id;
    const { question } = req.body;
    const product = await Products.findOne({ _id: id, user_id });
    if (!product) throw new Error('Product not found');
    const product_name = product.data[0].title;
    let strifigy = JSON.stringify(product.data[0]);
    strifigy = JSON.stringify(strifigy)
    let userstring = JSON.stringify(user?.info);
    const final_query = ` ${userstring != undefined ? `Here is my personal health information ${userstring}` : ""}  Here’s is the product facts ${strifigy} of a product I’m thinking of consuming.  ${question} and Return answer in JSON. and return the answer in the following format
                {
                    "answer": "ANSWER ACCORDING TO YOU"
                } if user asks something that will have some more data then the key for that object will be data like
                {
                    "answer": "ANSWER ACCORDING TO YOU"
                    "data": [STRINGS ONLY]
                }`
    const groqResponse = await groq(final_query);

    return returnResponse(200, "Success", groqResponse, res);
  } catch (err) {
    return returnResponse(400, err.message,"", res);
  }
});


const home = asyncHandler(async (req, res) => {
  try {
    const user_id = req.user?._id;
    const data = await Home(user_id);
    return returnResponse(200, "Fetched Scucessfully", data, res);
  } catch (err) {
    return returnResponse(400, err.message,"", res);
  }
})

module.exports = {
  GroqChat,
  home
};
