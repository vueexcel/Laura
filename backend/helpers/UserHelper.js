const User = require('../schemas/User');
const { groq, openaiMessage,embedText } = require('../helpers/groqHelper');
const { searchYouTube } = require('../middleware/common');
const { GetRecipe } = require('./productHelper');
const { generateAndPlaySpeech } = require('../helpers/elevenLabsHelper');
const moment = require('moment-timezone');
const AiChat = require('../schemas/AiChat');
// const now = new Date();
// const formattedDate = now.toISOString().slice(0, 19);


const getCode = async () => {
  return Math.floor(1000 + Math.random() * 9000)
}




const getProfile = async (user_id) => {
  try {
    const user = await User.findById(user_id, { password: 0, reset_code: 0 });
    if (user._doc.otp != "" && user._doc.social_type == "normal") {
      user._doc.is_verified = false;
    }
    else {
      user._doc.is_verified = true;
    }
    return user._doc;
  } catch (error) {
    throw new Error(error.message);
  }
}


// const GetOPENAIOPINION = async (user_id, question,onChunk) => {
//   try {
//     const user = await User.findById(user_id);
//     const chatExsists = await AiChat.findOne({ user_id })
//       .select('chat')
//       .slice('chat', -20);
//     const promptInteraction = `
//           The user has asked: "${question}". 
//           Here is the user's data: ${JSON.stringify(user)}.
//           Here is the user's previous data: ${JSON.stringify(chatExsists && chatExsists != undefined ? chatExsists.chat : " ")}.Return the following answer in JSON object as :{
//                      "emotion": "<one of: sad, regret, anxious, mellow, excited, neutral>",
//                      "reply": "<your assistant reply here>"
//                    }
//         `;
//     const answer = await openaiMessage(promptInteraction, user_id,onChunk);
//     if (chatExsists) {
//       await AiChat.updateOne({ user_id: user_id }, // Match the document with the given user_id
//         {
//           $push: {
//             "chat": {
//               question,
//               response: answer
//             }
//           }
//         }
//       );
//     }
//     else {
//       await AiChat.create({
//         user_id: user_id, "chat": {
//           question,
//           response: answer,

//         }
//       })
//     }
//     // const speech = await generateAndPlaySpeech(process.env.ELEVENLABSVOICEID, JSON.parse(answer).reply, JSON.parse(answer).emotion);
//     // const speech = await generateAndPlaySpeech(process.env.ELEVENLABSVOICEID, "I am so sorry to hear such a bad thing is happening to you. Lets take a deep breath and try to calm down and remember this time shall pass too. ", "sad");
//     return answer;
//   } catch (error) {
//     throw new Error(error.message);
//   }
// }

const GetOPENAIOPINION = async (user_id, question, onChunk, chatHistory) => {
  const user = await User.findById(user_id);
  const prompt = `
        The user asked: "${question}".
        User: ${JSON.stringify(user)}.
        Previous chats: ${JSON.stringify(chatHistory?.chat || [])}.
        Respond as JSON:
        {
            "emotion": "<sad|excited|neutral|regret|anxious|mellow>",
            "tone": <"soft, warm, flirty, smug, calm, grounded, slow, breathy, tender, vulnerable, confident, sultry, dreamy, nostalgic, fierce, inspiring, curious, caring, deep, sincere, low, serious, fragile, hurt, craving, playful, cheeky, thoughtful, withdrawn, poetic">,
            "reply": "<reply>"
        }
    `;

  const reply = await openaiMessage(prompt, question, onChunk);

  return reply;
};


// const detectQuery = async (question, user_id) => {
//   const prompt = `
//       Determine the following query about the context from: "${question}".
//     `;
//   const response = await openaiMessage(prompt, user_id);
//   return response.trim().toLowerCase() === "true";
// };




const GetPreviousChat = async (user_id, pageno) => {
  try {
    const perPage = 10;

    const result = await AiChat.aggregate([
      {
        $match: { user_id: user_id }
      },
      // {
      //     '$sort': {
      //         'interaction_history.date': -1
      //     }
      // },
      {
        $addFields: {
          pages: { $ceil: { $divide: ["$total", perPage] } }
        }
      },
      {
        $project: {
          data: { $slice: ["$chat", (pageno - 1) * perPage, perPage] },
          total: 1,
          pages: 1
        }
      }
    ]);
    if (!result.length) {
      // throw new Error('No previous chat found');
      return { data: [] }
    }
    return result[0];
  } catch (error) {
    throw new Error(error.message);
  }
}



module.exports = { getCode, getProfile, GetOPENAIOPINION, GetPreviousChat }