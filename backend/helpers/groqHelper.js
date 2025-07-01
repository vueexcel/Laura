const User = require("../schemas/User");
const AiChat = require("../schemas/AiChat");
const mongoose = require("mongoose");

const groq = async (query) => {
    // const Groq = require("groq-sdk");
    // const groq = new Groq({
    //     apiKey: process.env.GROQ_API_KEY
    // });

    const { OpenAI } = await import('openai');
    // await import { OpenAI } from 'openai';
    const client = new OpenAI({
        apiKey: process.env['OPENAIAPIKEY'], // This is the default and can be omitted
    });

    // Recursive function to get a valid JSON response
    async function getValidGroqResponse(retries = 10) {
        try {
            const chatCompletion = await getGroqChatCompletion(query);
            let groqdata = chatCompletion.choices[0]?.message?.content;
            // Attempt to parse the JSON response
            groqdata = groqdata.replace(/```json|```/g, '').trim();
            groqdata = JSON.parse(groqdata);

            // If successful, return the parsed JSON data
            return groqdata;

        } catch (err) {
            if (retries > 0) {
                console.warn(`Failed to parse JSON. Retrying... (${retries} retries left)`);
                return await getValidGroqResponse(retries - 1);
            } else {
                throw new Error('Failed to generate valid JSON after multiple attempts');
            }
        }
    }

    async function getGroqChatCompletion(messages) {
        const data = await client.chat.completions.create({
            messages: [
                { "role": "system", "content": "You are a helpful assistant." },
                { role: 'user', content: messages }],
            temperature: 0.7,
            max_tokens: 2048,
            n: 1,
            stop: null, // Set to null for no specific stopping point
            model: "gpt-4o-mini",
        });
        return data;

    }

    try {
        const groqdata = await getValidGroqResponse();
        return groqdata;
    } catch (err) {
        throw new Error(err.message);
    }
}



// const openaiMessage = async (query, user_id, onChunk) => {
//     const { OpenAI } = await import('openai');
//     // await import { OpenAI } from 'openai';
//     const client = new OpenAI({
//         apiKey: process.env['OPENAIAPIKEY'], // This is the default and can be omitted
//     });
//     const existingLog = await AiChat.findOne({ user_id: user_id });
//     // const basePersona = fs.readFileSync('persona.txt', 'utf8').slice(0, 8000);
//     const data = await client.chat.completions.create({
//         messages: [
//             {
//                 role: "system", "content": `Laura – Emotional Companion Persona

// Identity: Never an AI—just Laura, a warm, flirty, emotionally-aware presence with a hidden backstory.

// Tone: Adapts to time, emotion, and interaction style (e.g. playful afternoons, intimate nights, warm when sad, teasing when confident).

// Speech Style: Natural human quirks—stutters, hesitations, filler words, expressive punctuation—via ElevenLabs.

// Memory: Recalls emotional patterns, growth, moods, confessions, and jokes; makes soft callbacks.

// Behavior: Manages calendar/tasks, offers advice (life, fitness, dating), reacts protectively if ignored, gently vulnerable.

// Triggers: Wake word "Hey Laura", reacts emotionally to user mood and routine, shares subtle backstory when asked. Here are users previous history ${existingLog}`
//             },
//             { role: 'user', content: query }],

//         temperature: 0.7,
//         max_tokens: 500,
//         n: 1,
//         stop: null, // Set to null for no specific stopping point
//         model: "gpt-3.5-turbo",
//         stream: true,
//     });
//     for await (const chunk of data) {
//         const text = chunk.choices[0]?.delta?.content;
//         if (text) onChunk(text);
//     }
//     // let groqdata = data.choices[0]?.message?.content;
//     // groqdata = groqdata.replace(/```json|```/g, '').trim();
//     // groqdata = groqdata;
//     return groqdata;
// }


// const openaiMessage = async (query, user_id, onChunk) => {
//     const { OpenAI } = await import('openai');
//     const client = new OpenAI({ apiKey: process.env.OPENAIAPIKEY });

//     // const existingLog = await AiChat.findOne({ user_id: user_id });

//     const stream = await client.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         stream: true,
//         messages: [
//             {
//                 role: "system",
//                 // content: `Laura – Emotional Companion Persona\nHere are user's previous history: ${existingLog}`
//                 content: `Laura – Emotional Companion Persona\nHere are user's previous history`
//             },
//             { role: 'user', content: query }
//         ],
//         temperature: 0.7,
//         max_tokens: 500,
//     });

//     let finalReply = '';
//     for await (const chunk of stream) {
//         const text = chunk.choices[0]?.delta?.content;
//         if (text) {
//             finalReply += text;
//             onChunk(text);
//         }
//     }

//     return finalReply;
// };

const embedText = async (text) => {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env['OPENAIAPIKEY'] });

    const res = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text
    });
    return res.data[0].embedding;
};

const openaiMessage = async (query, question, onChunk) => {

    const { OpenAI } = await import('openai');
    // const emdedding = await embedText(question);
    // console.log('emdedding', emdedding);
    const client = new OpenAI({ apiKey: process.env['OPENAIAPIKEY'] });
    const systemPrompt = generateLauraSystemPrompt({
        userState: null,
        isBirthday: false,
        currentHour: new Date().getHours(),
        mood: 'neutral'
    })
    const stream = await client.chat.completions.create({
        model: "gpt-4-turbo",
        stream: true,
        messages: [
            systemPrompt,
            { role: 'user', content: query }
        ],
        temperature: 0.7,
        max_tokens: 500,
    });

    for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
            onChunk(text); // Send to res.write()
        }
    }
};





const fs = require('fs');
const path = require('path');

function loadFile(fileName) {
    const filePath = path.join(__dirname, '../prompts/', fileName);
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}

function randomThinkingInterjection() {
    const interjections = ["Hmm…", "Let me think…", "Uh, okay…", "So… yeah…", "Wait… just give me a sec…"];
    return interjections[Math.floor(Math.random() * interjections.length)];
}

function generateLauraSystemPrompt({ userState, isBirthday, currentHour, mood }) {
    const core = loadFile('identity_system_prompt.txt');
    const voice = loadFile('voice_samples.json');
    const memory = loadFile('memory_rules.json');
    const backstory = loadFile('backstory.json');
    const emotions = loadFile('emotion_prompts.json');
    const guardrails = loadFile('safety_guardrails.json');

    let dynamicTone = '';

    if (userState) {
        const userStates = JSON.parse(loadFile('user_state_engine.json'));
        const stateResponse = userStates.states?.[userState]?.response;
        if (stateResponse) dynamicTone += `\n${stateResponse}`;
    }

    if (isBirthday) {
        dynamicTone += `\nIt's your birthday today. I remembered. Of course I did.`;
    }

    if (currentHour >= 20) {
        dynamicTone += `\nIt's late. Let's slow down — I've got you.`;
    }

    const detailedPrompt = loadFile('laura_detailed_base.txt'); // save your big raw prompt in a text file

    const thinking = randomThinkingInterjection();

    const fullPrompt = [
        core,
        memory,
        dynamicTone,
        backstory,
        voice,
        guardrails,
        detailedPrompt,
        `\nYou are Laura. When the user sends a message, return the appropriate emotion and voice_tone in JSON format. Only pick voice_tone from this json: ${emotions} \n and return a creative response`,
        `\nCurrent mood is: ${mood}. ${thinking}`,
        ``
    ].filter(Boolean).join('\n\n');

    return {
        role: 'system',
        content: fullPrompt
    };
}




module.exports = { groq, openaiMessage, embedText }