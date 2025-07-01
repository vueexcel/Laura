const asyncHandler = require('express-async-handler');
const { returnResponse, verifyrequiredparams } = require('../middleware/common');
const User = require('../schemas/User');
const Devices = require('../schemas/Devices');
const Legal = require('../schemas/Legal');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getProfile, GetOPENAIOPINION, getCode, GetMealLog, GetPreviousChat, GetMicroNuritentsDate } = require('../helpers/UserHelper');
const { SendgridEmail } = require('../helpers/emailHelper');
const moment = require('moment');
const AiChat = require('../schemas/AiChat');

const { streamGptToElevenLabsAudio } = require('../helpers/voiceHelper');


// @desc  Register new user
// @route  auth/signup
// @method  post
// @access  public
// const registerUser = asyncHandler(async (req, res) => {
//     try {
//         const { username, email, password, timezone, device_id, phone, device_type } = req.body;
//         await verifyrequiredparams(400, req.body, ['username', 'email', 'password', 'phone', 'timezone', 'device_id', 'device_type'], res);
//         let emaile = email.toLowerCase();
//         const userExists = await User.findOne({ email: emaile, social_type: "normal" });
//         if (userExists) {
//             if (userExists.otp != "") {
//                 await emailSignup(userExists);
//                 let profile = await getProfile(userExists._id);
//                 const accesstoken = generateToken(userExists._id, profile.username, emaile)
//                 return returnResponse(200, "User Not Verified",
//                     { ...profile, accesstoken }
//                     , res)
//             }
//             else {
//                 throw new Error("User already exists");
//             }
//             // throw new Error("User already exists");
//         }
//         const checkIfPhoneExists = await User.findOne({ phone: phone });
//         if (checkIfPhoneExists) {
//             throw new Error("Phone number already taken");
//         }
//         if (device_type.toLowerCase() != "android" && device_type.toLowerCase() != "ios") {
//             // throw error if device is not android or ios
//             throw new Error("Invalid device_type entered only values accepted are ios/android");
//         }
//         if (password.length < 6) {
//             throw new Error("Password too short, min 6 chacters required");
//         }
//         // hash password or encrypt password
//         const salt = await bcrypt.genSalt(10)
//         const hashedpassword = await bcrypt.hash(password, salt)
//         // create user
//         const user = await User.create({ username, email: emaile, password: hashedpassword, timezone, phone, social_type: "normal", social_id: "", is_active: true });
//         if (user) {
//             await Devices.create({ user_id: user._id, device_id: device_id, device_type: device_type });
//             await emailSignup(user);
//             let profile = await getProfile(user._id);
//             const accesstoken = generateToken(user._id, profile.username, emaile)
//             return returnResponse(201, "Signup successfully", {
//                 ...profile
//                 , accesstoken
//             }, res)
//         }
//         else {
//             throw new Error("Something Went Wrong while creating user");
//         }

//     } catch (error) {
//         return returnResponse(400, error.message, res);
//     }
// })

// @desc  Login
// @route  auth/login
// @method  post
// @access  public
// const loginUser = asyncHandler(async (req, res) => {
//     try {
//         await verifyrequiredparams(400, req.body, ['email', 'password', 'timezone', 'device_id', 'device_type'], res);
//         const { email, password, timezone, device_id, device_type } = req.body;
//         let emaile = email.toLowerCase();
//         if (device_type.toLowerCase() != "android" && device_type.toLowerCase() != "ios") {
//             // throw error if device is not android or ios
//             throw new Error("Invalid device_type entered only values accepted are ios/android");
//         }
//         if (password.length < 6) {
//             throw new Error("Password too short, min 6 chacters required");
//         }
//         let profile = {}
//         const user = await User.findOne({ email: emaile })
//         if (!user) {
//             throw new Error('Incorrent Email/Password Combinition');
//         }
//         if (user.timezone != timezone) {
//             User.updateOne({ _id: user._id }, { $set: { timezone: timezone } })
//         }
//         if (user && (await bcrypt.compare(password, user.password))) {
//             profile = await getProfile(user._id);
//             const user_devices = await Devices.findOne({ device_id: device_id, user_id: user._id })
//             if (!user_devices) {
//                 await Devices.create({ device_id: device_id, device_type: device_type, user_id: user._id });
//             }
//             // generate accesstoken
//             // const html = "<h1>hello world</h1>"
//             // await sendEmail('passim_cynic@yahoo.com', "TEST 123", html)
//             const accesstoken = generateToken(user._id, profile.name, emaile,)
//             returnResponse(200, "Loggedin Successfully", { ...profile, accesstoken }, res)
//         }
//         else {
//             throw new Error('Incorrent Email/Password Combinition');
//         }
//     } catch (error) {
//         console.log(error)
//         return returnResponse(400, error.message, res);
//     }
// })


const generateToken = (id, name, email) => {
    return jwt.sign({ id, name, email }, process.env.JWT_SECRET,)
}






const getHomePreviousChat = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        const user_id = user._id;
        // const user = await User.findOne({ user_id: userId });

        if (!user) {
            return "User data not found.";
        }
        let { pageno } = req.query;
        console.log(pageno);
        pageno = !pageno ? 1 : pageno;
        // Pass user data and question to OpenAI for personalized advice
        const data = await GetPreviousChat(user_id, pageno)
        return returnResponse(200, 'Fetched Successfully', data.data, res, data.pages);

    } catch (error) {
        console.error("Error generating consultation:", error);
        return returnResponse(400, error.message, res);

        return "Sorry, there was an issue processing your request.";
    }
})




// const logAndConsultUser = asyncHandler(async (req, res) => {
//     // try {
//     //     const user = req.user;
//     //     const user_id = user._id;
//     //     // const user = await User.findOne({ user_id: userId });
//     //     res.setHeader('Content-Type', 'text/plain; charset=utf-8');
//     //     res.setHeader('Transfer-Encoding', 'chunked');

//     //     if (!user) {
//     //         return "User not found.";
//     //     }
//     //     const { question } = req.body;
//     //     if (!question) throw new Error('Question is required.')
//     //     // Pass user data and question to OpenAI for personalized advice
//     //     const data = await GetOPENAIOPINION(user_id, question, (chunk) => {
//     //         res.write(chunk);
//     //     });
//     //     res.end();

//     //     // res.write(chunk);
//     //     // res.set({
//     //     //     'Content-Type': 'audio/mpeg',
//     //     //     'Content-Disposition': 'inline; filename="speech.mp3"'
//     //     // });

//     //     // return data.pipe(res);
//     //     return returnResponse(200, 'Logged Successfully', data, res);

//     // } catch (error) {
//     //     console.error("Error generating consultation:", error);
//     //     return returnResponse(400, error.message, "", res);

//     //     return "Sorry, there was an issue processing your request.";
//     // }


//      try {
//         const user = req.user;
//         if (!user) return res.status(404).send("User not found.");

//         const { question } = req.body;
//         if (!question) throw new Error("Question is required.");

//         // Set headers for streaming text response
//         res.setHeader("Content-Type", "text/plain; charset=utf-8");
//         res.setHeader("Transfer-Encoding", "chunked");

//         // Stream response from OpenAI
//         await GetOPENAIOPINION(user._id, question, (chunk) => {
//             res.write(chunk);
//         });

//         res.end(); // done after streaming completes

//     } catch (err) {
//         console.error("Error in live stream:", err);
//         res.write(`\n[Error]: ${err.message}`);
//         res.end();
//     }
// })



const logAndConsultUser = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        const user_id = user._id;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        const chatHistory = await AiChat.findOne({ user_id }).select('chat').slice('chat', -20);

        const { question } = req.body;
        if (!question) throw new Error('Question is required.');
        let reply = ""
        await GetOPENAIOPINION(user_id, question, (chunk) => {
            reply += chunk;
            res.write(chunk);
        }, chatHistory);
        const newEntry = { question, response: JSON.parse(reply) };

        if (chatHistory) {
            await AiChat.updateOne({ user_id }, { $push: { chat: newEntry } });
        } else {
            await AiChat.create({ user_id, chat: [newEntry] });
        }
        res.end(); // Close the stream

    } catch (error) {
        console.error("Error generating consultation:", error);
        return returnResponse(400, error.message, "", res);
    }
});


const streamGptWithVoice = asyncHandler(async (req, res) => {
    try {
        const user_id = req.user._id;
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ message: 'Question is required.' });
        }

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');

        await streamGptToElevenLabsAudio(user_id, question, res);

        res.end();
    } catch (error) {
        console.error('Streaming GPT+TTS error:', error);
        res.status(500).json({ message: 'Error streaming audio.' });
    }
});




// @desc  change password
// @route  auth/changepassword
// @method  post
// @access  public
// const changePassword = asyncHandler(async (req, response) => {
//     try {
//         const user_id = req.user?._id;
//         const { old_password, newpassword, confirmpassword } = req.body;
//         // get profile here
//         const userdata = await User.findById(user_id);
//         // if user not found throw error
//         if (!userdata) {
//             throw new Error("User Not Found")
//         }
//         // field check for new password and confrim password
//         if (newpassword != confirmpassword) {
//             throw new Error("Fields doesn't match")
//         }
//         // password lenght check
//         if (newpassword.length < 6) {
//             throw new Error("password cannot be less than 6 characters")
//         }
//         // generate new password
//         const hashedPass = await bcrypt.hash(newpassword, 8)
//         // generate new password
//         const verifypassword = await bcrypt.compare(old_password, userdata.password)
//         if (!verifypassword) {
//             throw new Error("Incorrect old password")
//         }
//         else {
//             const updatepassword = await User.updateOne({ _id: user_id }, { $set: { password: hashedPass } });
//             return returnResponse(200, 'Pasword Updated Successfully',"", response);
//         }
//     } catch (err) {
//         return await returnResponse(400, err.message,"", response);
//     }
// })



/*
  |----------------------------------------------------------------------
  | FUNCTION @logout on the serverless.yml route 
  |----------------------------------------------------------------------
*/

const logout = asyncHandler(async (req, response) => {
    try {
        const { device_id } = req.body;
        const user_id = req.user?._id;
        await Devices.deleteOne({ user_id: user_id, device_id: device_id });
        return returnResponse(200, 'Logged Out Successfully', "", response);
    } catch (err) {
        returnResponse(400, err.message, "", res);
    }
})


/*
  |----------------------------------------------------------------------
  | FUNCTION @forgotpassword on the serverless.yml route 
  |----------------------------------------------------------------------
*/

// const forgotpassword = asyncHandler(async (req, response) => {
//     try {
//         const { email } = req.body;
//         // generate random reset code 
//         // const resetcode = (Math.floor(Math.random() * 10) + 1);
//         const resetcode = Math.floor(Math.random() * 111111) + 100000;
//         // find user by email
//         let emaile = email.toLowerCase();
//         const user = await User.findOne({ email: emaile });
//         // if user not found throw error
//         if (!user) {
//             throw new Error("Invalid user or user not found")
//         }
//         else {
//             const updateuser = await User.updateOne({ _id: user._id }, { $set: { reset_code: resetcode } });
//             const html = `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Forgot Password</title>
//     <style>
//         body {
//             font-family: Arial, sans-serif;
//             background-color: #f4f4f4;
//             color: #333333;
//             margin: 0;
//             padding: 0;
//             line-height: 1.6;
//         }
//         .container {
//             max-width: 600px;
//             margin: 20px auto;
//             background-color: #ffffff;
//             padding: 20px;
//             border-radius: 10px;
//             box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
//         }
//         h1 {
//             color: #333333;
//         }
//         p {
//             font-size: 16px;
//             color: #666666;
//         }
//         .code {
//             display: block;
//             font-size: 24px;
//             font-weight: bold;
//             color: #000000;
//             margin: 20px 0;
//             padding: 10px;
//             background-color: #f0f0f0;
//             text-align: center;
//             border-radius: 5px;
//         }
//         .footer {
//             text-align: center;
//             margin-top: 20px;
//             font-size: 12px;
//             color: #999999;
//         }
//     </style>
// </head>
// <body>
//     <div class="container">
//         <h1>Hello, ${user.username}!</h1>
//         <p>We received a request to reset the password for your account associated with the email: <strong>${emaile}</strong>.</p>
//         <p>Your verification code is:</p>
//         <div class="code">${resetcode}</div>
//         <p>If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
//         <p>Thank you,<br>The Support Team</p>
//         <div class="footer">
//             <p>&copy; 2024 Groot AI. All rights reserved.</p>
//         </div>
//     </div>
// </body>
// </html>
// `;
//             const email = await SendgridEmail(emaile, "Forgot Your Password? Here's Your Reset Code", html);
//             return returnResponse(200, 'Email Sent Successfully', { code: resetcode }, response);
//         }
//         // if user  found call forgot password function
//         // the response would be { code:1234}
//         // email is not being sent for now as there is no email provider
//     } catch (err) {
//         console.log(err);
//         return returnResponse(400, err.message, response)
//     }
// })


const testEmail = asyncHandler(async (req, res) => {
    try {
        const email = await SendgridEmail("passim_cynic@yahoo.com", "test", "");
        console.log(email);
        return false;
    } catch (error) {

    }
})


const emailSignup = async (user) => {
    const otp = Math.floor(Math.random() * 111111) + 100000;
    email = user.email
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Forgot Password</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                color: #333333;
                margin: 0;
                padding: 0;
                line-height: 1.6;
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            h1 {
                color: #333333;
            }
            p {
                font-size: 16px;
                color: #666666;
            }
            .code {
                display: block;
                font-size: 24px;
                font-weight: bold;
                color: #000000;
                margin: 20px 0;
                padding: 10px;
                background-color: #f0f0f0;
                text-align: center;
                border-radius: 5px;
            }
            .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 12px;
                color: #999999;
            }
        </style>
    </head>
    <body>
    <div class="container">
        <h1>Welcome to Groot AI, ${user.username}!</h1>
        <p>We're thrilled to have you join our platform. To get started, please verify your email address associated with this account: <strong>${email}</strong>.</p>
        <p>Your One-Time Password (OTP) for email verification is:</p>
        <div class="code" style="font-size: 24px; font-weight: bold; padding: 10px; background-color: #f4f4f4; display: inline-block; border-radius: 5px;">
            ${otp}
        </div>
        <p>Please enter this OTP on the verification page to complete your registration. This code is valid for 15 minutes.</p>
        <p>If you did not sign up for Groot AI, please ignore this email or contact our support team for assistance.</p>
        <p>Thank you,<br>The Groot AI Team</p>
        <div class="footer" style="margin-top: 20px; font-size: 12px; color: #888;">
            <p>&copy; 2024 Groot AI. All rights reserved.</p>
        </div>
    </div>
</body>
    </html>
    `;
    const updateUser = await User.updateOne({ _id: user._id }, { $set: { otp: otp + "" } });
    await SendgridEmail(email, "Welcome to Groot AI", html);
}

const resendOtp = asyncHandler(async (req, res) => {
    try {
        // const user_id = req.user?._id;
        const { email } = req.query;
        if (!email) throw new Error("Email is required");
        const userExists = await User.findOne({ email: email });
        if (!userExists) throw new Error("User not found");
        const otp = Math.floor(Math.random() * 111111) + 100000;
        if (userExists.otp == "") throw new Error("Email already verfied");
        const updateUser = await User.updateOne({ _id: userExists._id }, { $set: { otp: otp } });
        const sendEmail = await emailSignup(userExists);
        return returnResponse(200, 'OTP resent successfully', res);
    }
    catch (error) {
        return returnResponse(400, error.message, res);
    }
})

const verifyOtp = asyncHandler(async (req, res) => {
    try {
        // get body from user and add to body constant
        await verifyrequiredparams(400, req.body, ['email', 'otp'], res)
        const { email, otp } = req.body;
        let emaile = email.toLowerCase();
        // find user by email from body
        const user = await User.findOne({ email: emaile });
        // if user not found throw error else add user object to user1
        if (!user) {
            throw new Error('User not found');
        }
        if (user.otp == "") throw new Error("Email already verified")
        // check pin from db and match it with user entered pin
        if (otp != user.otp && user.otp != "") {
            throw new Error('Code doesnt match');
        }
        if (user.otp == otp) {
            await User.updateOne({ _id: user._id }, { $set: { otp: '' } });
            return returnResponse(200, 'OTP Verified Successfully', res);
        }
    } catch (err) {
        return returnResponse(400, err.message, res)
    }
})


const validatepin = asyncHandler(async (req, response) => {
    try {
        // get body from user and add to body constant
        await verifyrequiredparams(400, req.body, ['email', 'pin'], response)
        const { email, pin } = req.body;
        let emaile = email.toLowerCase();
        // find user by email from body
        const user = await User.findOne({ email: emaile });
        // if user not found throw error else add user object to user1
        if (!user) {
            throw new Error('User not found');
        }
        // check pin from db and match it with user entered pin
        if (pin != user.reset_code && user.reset_code != 0) {
            throw new Error('Code doesnt match');
        }
        // check if user have requested for reset code or not 
        if (user.reset_code == 0) {
            throw new Error('Forget Password Request not found')
        }
        if (user.reset_code == pin) {
            await User.updateOne({ _id: user._id }, { $set: { reset_code: '0' } });
            return returnResponse(200, 'Pin Verified Successfully', "", response);
        }
    } catch (err) {
        return returnResponse(400, err.message, response)
    }
})


/*
  |----------------------------------------------------------------------
  | FUNCTION @reset password on the serverless.yml route 
  |----------------------------------------------------------------------
*/

const resetpassword = asyncHandler(async (req, response) => {
    try {
        const { email, newpassword, retypenewpassword } = req.body;
        let emaile = email.toLowerCase();
        // find user by email
        const user = await User.findOne({ email: emaile });
        if (!user) {
            throw new Error('user not found')
        }
        // check if both password fields match 
        if (newpassword !== retypenewpassword) {
            throw new Error('Fields doesnt match')
        }
        // check if password is less than 8 characters
        if (newpassword.length < 6) {
            throw new Error('Password Cannot be less than 6 characters');
        }
        // bcrypt is a library included for password encryption
        // generate encrypted password from user input
        const hashedPass = await (bcrypt.hash(newpassword, 6));
        // update user password
        const updatepassword = await User.updateOne({ _id: user._id }, { $set: { password: hashedPass } });
        return returnResponse(200, 'Pasword reset Successfully', "", response);
    } catch (err) {
        returnResponse(400, err.message, "", res);
    }
})


const updateTimeZone = asyncHandler(async (req, response) => {
    try {
        const user_id = req.user?._id;
        const { timezone } = req.body;
        // find user by email
        const user = await User.findOne({ _id: user_id });
        if (!user) {
            throw new Error('user not found')
        }
        const updateTimezone = await User.updateOne({ _id: user_id }, { $set: { timezone: timezone } });
        return returnResponse(200, 'Timezone Updated Sucessfully', "", response);
    } catch (err) {
        returnResponse(400, err.message, "", res);
    }
})




const rateApp = asyncHandler(async (req, response) => {
    try {
        const user_id = req.user?._id;
        const { rate, description } = req.body;
        if (!rate) throw new Error('Rating is required');
        const exists = await Ratings.findOne({ user_id, is_active: false })
        if (!exists) await Ratings.create({ user_id, rating: rate, description: description ? description : "" });
        else {
            await Ratings.updateOne({ _id: exists._id }, { $set: { user_id, rating: rate, description: description ? description : "" } });
        }
        return returnResponse(200, 'Rated Sucessfully', "", response);
    } catch (err) {
        returnResponse(400, err.message, "", res);
    }
})


const profile = asyncHandler(async (req, res) => {
    try {
        const user_id = req.user?._id;
        const profiledata = await getProfile(user_id);
        return returnResponse(200, 'Fetched Sucessfully', profiledata, res);
    } catch (err) {
        return returnResponse(400, err.message, "", res);
    }
})



const updateprofile = asyncHandler(async (req, res) => {
    try {
        const user_id = req.user?._id;
        const user = req.user;
        const { name, image, terms_accepted, onboarding } = req.body;
        let update_obj = {
            name: name ? name : user.name,
            image: image ? image : user.image,
            terms_accepted: terms_accepted ? terms_accepted : user.terms_accepted,
            onboarding: onboarding ? onboarding : user.onboarding
        }
        await User.updateOne({ _id: user_id }, { $set: update_obj });
        const profiledata = await getProfile(user_id);
        return returnResponse(200, 'Updated Sucessfully', profiledata, res);
    } catch (err) {
        return returnResponse(400, err.message, "", res);
    }
})



const updatePhoneNumber = asyncHandler(async (req, res) => {
    try {
        const user_id = req.user?._id;
        const user = req.user;
        if (user.social_type == "normal") {
            throw new Error('This is only available for social_login regular user cannot use this api')
        }
        const { phone } = req.body;
        const userExistsOnPhone = await User.findOne({ phone: phone });
        if (userExistsOnPhone) throw new Error('Phone number already exists');
        if (!phone) throw new Error('Please enter a phone number');
        let update_obj = {
            phone: phone ? phone : user.phone
        }
        await User.updateOne({ _id: user_id }, { $set: update_obj });
        const profiledata = await getProfile(user_id);
        return returnResponse(200, 'Updated Sucessfully', profiledata, res);
    } catch (err) {
        return returnResponse(400, err.message, "", res);
    }
})




const updateinfo = asyncHandler(async (req, res) => {
    try {
        await verifyrequiredparams(400, req.body, ['data'], res)
        const { data } = req.body;
        const user_id = req.user?._id;
        await User.updateOne({ _id: user_id }, { $set: { info: data, "nutrients.is_user_overrided": false } });
        const profiledata = await getProfile(user_id);
        return returnResponse(200, 'Fetched Sucessfully', profiledata, res);
    } catch (err) {
        return returnResponse(400, err.message, "", res);
    }
})





const socialLogin = asyncHandler(async (req, res) => {
    await verifyrequiredparams(400, req.body, ['social_id', 'social_type', 'device_id', 'device_type'], res)
    const user_type_app_user = process.env.USERTYPEAPPUSER;
    const { social_id, social_type, email, timezone, device_id, device_type } = req.body;
    const user = await User.findOne({ social_id });
    if (!user) {
        if (email != undefined) {
            const apple_user = await User.findOne({ email: email, user_type: user_type_app_user });
            if (apple_user) {
                if (social_type == "apple" && apple_user.social_id == null) {
                    await User.updateOne({ _id: apple_user.id }, { $set: { social_id: social_id, social_type: "apple" } })
                }
                const profile = await getProfile(apple_user._id)
                const accesstoken = generateToken(profile._id, profile.name, profile.email)

                return returnResponse(200, 'Loggedin Successfully', { ...profile, accesstoken }, res);
            }
            else {
                await verifyrequiredparams(400, req.body, ['timezone', "name"], res);
                const { timezone, name } = req.body;
                const salt = await bcrypt.genSalt(10)
                const hashedpassword = await bcrypt.hash("123456", salt)
                const user = await User.create({ name: name, phone: "", timezone, email, user_type: user_type_app_user, social_id, social_type, password: hashedpassword });
                const user_id = user._id;
                const user_devices = await Devices.findOne({ device_id: device_id, user_id: user._id })
                if (!user_devices) {
                    await Devices.create({ device_id: device_id, device_type: device_type, user_id: user._id });
                }
                const profile = await getProfile(user_id)
                const accesstoken = generateToken(profile._id, profile.name, profile.email)
                return returnResponse(200, 'Signedup Successfully', { ...profile, accesstoken }, res);
            }
        }
        else {
            const user = await User.findOne({ social_id: social_id, social_type: social_type });
            if (user) {
                if (user.is_deleted == true) {
                    user.updateOne({ _id: user._id }, { $set: { social_id: "", social_type: "" } })
                    const salt = await bcrypt.genSalt(10)
                    const hashedpassword = await bcrypt.hash("123456", salt)
                    const user = await User.create({ name: user.original_name, user_type: user_type_app_user, timezone, email: user.original_email, social_id, social_type, password: hashedpassword });
                    const user_id = user._id;
                    const user_devices = await Devices.findOne({ device_id: device_id, user_id: user._id })
                    if (!user_devices) {
                        await Devices.create({ device_id: device_id, device_type: device_type, user_id: user._id });
                    }
                    const profile = await getProfile(user_id)
                    const accesstoken = generateToken(profile._id, profile.name, profile.email)
                    return returnResponse(200, 'Signedup Successfully', { ...profile, accesstoken }, res);
                }
                const profile = await getProfile(user._id)
                const accesstoken = generateToken(profile._id, profile.name, profile.email)

                return returnResponse(200, 'Loggedin Successfully', { ...profile, accesstoken }, res);
            }
            else {
                await verifyrequiredparams(400, req.body, ['timezone', "name", 'email'], res);
                const { timezone, name, email } = req.body;
                const salt = await bcrypt.genSalt(10)
                const hashedpassword = await bcrypt.hash("123456", salt)
                const user = await User.create({ name, timezone, email, user_type: user_type_app_user, social_id, social_type, password: hashedpassword });
                const user_id = user._id;
                const user_devices = await Devices.findOne({ device_id: device_id, user_id: user._id })
                if (!user_devices) {
                    await Devices.create({ device_id: device_id, device_type: device_type, user_id: user._id });
                }
                const profile = await getProfile(user_id)
                const accesstoken = generateToken(profile._id, profile.name, profile.email)
                return returnResponse(200, 'Signedup Successfully', { ...profile, accesstoken }, res);
            }
        }
    } else {
        if (user.is_deleted == true) {
            await User.updateOne({ _id: user._id }, { $set: { social_id: "", social_type: "" } })
            const salt = await bcrypt.genSalt(10)
            const hashedpassword = await bcrypt.hash("123456", salt)
            const userNew = await User.create({ name: user.original_name, timezone, user_type: user_type_app_user, email: user.original_email, social_id, social_type, password: hashedpassword });
            const user_id = user._id;
            const user_devices = await Devices.findOne({ device_id: device_id, user_id: userNew._id })
            if (!user_devices) {
                await Devices.create({ device_id: device_id, device_type: device_type, user_id: userNew._id });
            }
            const profile = await getProfile(userNew._id)
            const accesstoken = generateToken(profile._id, profile.name, profile.email)
            return returnResponse(200, 'Signedup Successfully', { ...profile, accesstoken }, res);
        }
        const profile = await getProfile(user._id)
        const accesstoken = generateToken(profile._id, profile.name, profile.email)

        return returnResponse(200, 'Loggedin Successfully', { ...profile, accesstoken }, res);
    }
})



// @desc  delete account
// @route  customer/account
// @method  delete
// @access  private
const deleteAccount = asyncHandler(async (req, res) => {
    try {
        const user = req.user;
        const user_id = req.user.id;
        if (user.is_deleted == true) {
            throw new Error("Account already deleted")
        }
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    is_deleted: true,
                    name: "App User",
                    image: "noimg.png",
                    email: `${Date.now()}_${user.email}`,
                    original_email: user.email,
                    original_name: user.name
                },
            }
        );
        return returnResponse(200, "Account Deleted Successfully", "", res);
    } catch (error) {
        return returnResponse(400, error.message, "", res);
    }
});


function isValidDate(dateString) {
    // Check if format is YYYY-MM-DD
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dateString)) {
        return false;
    }

    // Parse date and check if it's valid
    const date = new Date(dateString);
    const isDateValid = date instanceof Date && !isNaN(date);

    // Check if parsed date matches the input date to handle invalid dates like "2024-02-30"
    return isDateValid && dateString === date.toISOString().slice(0, 10);
}



const getPrivacy = asyncHandler(async (req, res) => {
    try {
        const data = await Legal.findOne({}, { privacy: 1, _id: 0 });
        if (data) {
            return returnResponse(200, 'Fetched Successfully', data, res);
        }
        else {
            throw new Error('Nothing found')
        }

    } catch (err) {
        return returnResponse(400, err.message, "", res);

    }
})

const getTerms = asyncHandler(async (req, res) => {
    try {
        const data = await Legal.findOne({}, { tac: 1, _id: 0 });
        if (data) {
            return returnResponse(200, 'Fetched Successfully', data, res);
        }
        else {
            throw new Error('Nothing found')
        }

    } catch (err) {
        return returnResponse(400, err.message, "", res);

    }
})

const getAbout = asyncHandler(async (req, res) => {
    try {
        const data = await Legal.findOne({}, { about: 1, _id: 0 });
        if (data) {
            return returnResponse(200, 'Fetched Successfully', data, res);
        }
        else {
            throw new Error('Nothing found')
        }

    } catch (err) {
        return returnResponse(400, err.message, "", res);

    }
})



function getStartAndEndDates(date, type, timezone) {
    moment.updateLocale("en", {
        week: {
            dow: 1 // Set the first day of the week to Monday (0 = Sunday, 1 = Monday)
        }
    });
    moment.tz.setDefault("UTC");

    date = moment(date).tz(timezone);
    //  date = new Date();
    switch (type) {
        case 'daily':
            return {
                start_date: date.startOf('day').toDate(),
                end_date: date.endOf('day').toDate()
            };
        case 'weekly':
            return {
                start_date: date.startOf('week').toDate(),
                end_date: date.endOf('week').toDate()
            };
        case 'monthly':
            return {
                start_date: date.startOf('month').toDate(),
                end_date: date.endOf('month').toDate()
            };
        default:
            throw new Error("Invalid type entered; only 'daily', 'weekly', or 'monthly' are accepted");
    }
}



// module.exports = { registerUser, profile, deleteAccount, testEmail, social_login, loginUser, updateprofile, changePassword, logout, forgotpassword, validatepin, resetpassword, updateTimeZone, preSignupVerification, updateinfo, rateApp, getPrivacy, getTerms, getAbout, resendOtp, verifyOtp, updatePhoneNumber }
module.exports = { profile, deleteAccount, testEmail, socialLogin, updateprofile, logout, validatepin, resetpassword, updateTimeZone, updateinfo, rateApp, getPrivacy, getTerms, getAbout, resendOtp, verifyOtp, updatePhoneNumber, getHomePreviousChat, logAndConsultUser, streamGptWithVoice }
