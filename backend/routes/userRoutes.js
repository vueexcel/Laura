const express = require('express');
const router = express.Router();
// const { registerUser, loginUser, testEmail, profile, updateprofile, deleteAccount, social_login, changePassword, logout, forgotpassword, validatepin, resetpassword, updateTimeZone, preSignupVerification, updateinfo, rateApp, logAndConsultUser, getMealLogs, getHomePreviousChat, general_info, deleteMealLogs, getPrivacy, getTerms, getAbout, updateLimits, getMicronutrients, resendOtp, verifyOtp, updatePhoneNumber } = require('../controllers/userController');
const { testEmail, profile, updateprofile, deleteAccount, logAndConsultUser, socialLogin, getHomePreviousChat, logout, validatepin, resetpassword, updateTimeZone, updateinfo, rateApp, getPrivacy, getTerms, getAbout, resendOtp, verifyOtp, updatePhoneNumber, streamGptWithVoice } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const user_type_app_user = process.env.USERTYPEAPPUSER;


// router.post('/signup', registerUser)
//     .post('/social_login', social_login)
//     .post('/login', loginUser)
//     .put('/changepassword', protect([user_type_app_user]), changePassword)
//     .post('/logout', protect([user_type_app_user]), logout)
//     .put('/forgotpassword', forgotpassword)
//     .put('/validatepin', validatepin)
//     .put('/resetpassword', resetpassword)
//     .put('/timezone', protect([user_type_app_user]), updateTimeZone)
//     .get('/profile', protect([user_type_app_user]), profile)
//     .delete('/account/delete', protect([user_type_app_user]), deleteAccount)
//     .put('/profile', protect([user_type_app_user]), updateprofile)
//     .put('/phone', protect([user_type_app_user]), updatePhoneNumber)
//     .post('/signup/verify', preSignupVerification)
//     .put('/info', protect([user_type_app_user]), updateinfo)
//     .post('/rate', protect([user_type_app_user]), rateApp)
//     .put('/general/info', protect([user_type_app_user]), general_info)
//     .get('/email/test', testEmail)
//     .get('/meal/logs', protect([user_type_app_user]), getMealLogs)
//     .delete('/meal/logs/:id', protect([user_type_app_user]), deleteMealLogs)
//     .post('/home/chat', protect([user_type_app_user]), logAndConsultUser)
//     .get('/home/chat/history', protect([user_type_app_user]), getHomePreviousChat)
//     .get('/about', getAbout)
//     .get('/privacy', getPrivacy)
//     .get('/terms', getTerms)
//     .get('/resendOtp', resendOtp)
//     .put('/verifyOtp', verifyOtp)
//     .put('/profile/limits', protect([user_type_app_user]), updateLimits)
//     .get('/micronutrients', protect([user_type_app_user]), getMicronutrients)




router.post('/social_login', socialLogin)
    .post('/logout', protect([user_type_app_user]), logout)
    .put('/validatepin', validatepin)
    .put('/resetpassword', resetpassword)
    .put('/timezone', protect([user_type_app_user]), updateTimeZone)
    .get('/profile', protect([user_type_app_user]), profile)
    .delete('/account/delete', protect([user_type_app_user]), deleteAccount)
    .put('/profile', protect([user_type_app_user]), updateprofile)
    .put('/phone', protect([user_type_app_user]), updatePhoneNumber)
    .put('/info', protect([user_type_app_user]), updateinfo)
    .post('/rate', protect([user_type_app_user]), rateApp)
    .get('/email/test', testEmail)
    .post('/home/chat', protect([user_type_app_user]), logAndConsultUser)
    .post('/stream', protect([user_type_app_user]), streamGptWithVoice)
    .get('/home/chat/history', protect([user_type_app_user]), getHomePreviousChat)
    .get('/about', getAbout)
    .get('/privacy', getPrivacy)
    .get('/terms', getTerms)
    .get('/resendOtp', resendOtp)
    .put('/verifyOtp', verifyOtp)





// .post('/socket', protect([user_type_app_user]), testSocketio).get('/faq', getFaq).get('/privacy', getPrivacy).get('/terms', getTerms).get('/about', getAbout);

module.exports = router