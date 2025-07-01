const asyncHandler = require('express-async-handler');
const { returnResponse, verifyrequiredparams } = require('../middleware/common');
const { groq } = require('../helpers/groqHelper');

const groqPrompt = asyncHandler(async (req, res) => {
    const user_id = req.user?._id;
    const { query } = req.body;
    if (!query) throw new Error('Query is required');
    const final_query = `Generate 4 meaningful questions to ${query} that someone would want to know that they would not be able to find out at first glance. Then answer the questions as well, answer should be not be shorter than 10 no longer than 16 words each. Look up the answers if you need to. Return answer in JSON. and return the answer in the following format "questions": [
                {
                    "question": "Does Old El Paso use synthetic preservatives?",
                    "answer": "No artificial preservatives or flavors used"
                },
                {
                    "question": "What types of spices are used?",
                    "answer": "A blend of 24 secret spices"
                },
                {
                    "question": "Is it gluten-free and vegan?",
                    "answer": "Yes, gluten-free and vegan compliant"
                },
                {
                    "question": "Are there any additives or fillers?",
                    "answer": "No artificial colors or fillers used"
                }
            ],`
    try {
        const groqResponse = await groq(final_query);
        await returnResponse(200, "Success", groqResponse, res);
    } catch (err) {
        return PrintError(400, err.message, res);
    }
});



module.exports = { groqPrompt }
