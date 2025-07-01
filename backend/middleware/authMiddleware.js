const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../schemas/User');
// const { returnResponse } = require('./common');

const protect = (allowedUserTypes = [], requiredPermissions = []) => asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from header
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token
            const user = await User.findById(decoded.id, { password: 0 });

            if (!user) {
                return res.status(401).json({ status: 401, message: "User not found" });
            }

            // Check user type and permissions dynamically
            const userTypeRule = allowedUserTypes.find(rule => {
                if (typeof rule === 'object' && rule.user_type) {
                    // Check if the user_type matches for object entries
                    return rule.user_type === user.user_type + "";
                }
                // Check if the user_type matches for string entries
                return rule === user.user_type + "";
            });


            if (!userTypeRule) {
                return res.status(403).json({ status: 403, message: "Access denied: User type not allowed" });
            }

            // If an access param is defined, check required permissions
            if (userTypeRule && userTypeRule.access) {
                const permissionsToCheck = userTypeRule.access.concat(requiredPermissions);
                if (!permissionsToCheck.every(permission => user.permission_level == permission)) {
                    return res.status(403).json({ status: 403, message: "Access denied: insufficient permissions" });
                }
                else {
                    if (decoded.employer_id && req.originalUrl != "/api/venue/profile" && req.originalUrl != "/api/venue/password") {
                        user._id = user.employer_id;
                    }
                }
            }
            if (user.status == false) {
                return res.status(401).json({ status: 401, message: "Account disabled" });
            }

            req.user = user;
            next();
        } catch (error) {
            res.status(401).json({ status: 401, message: error.message });
        }
    } else {
        res.status(403).json({ status: 403, message: "Bearer Token missing" });
    }
});



module.exports = {
    protect,
};
