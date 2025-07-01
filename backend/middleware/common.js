const User = require("../schemas/User");
const Devices = require("../schemas/Devices");
const moment = require("moment");
const successResponse = (
  statusCode = 200,
  Message,
  Body,
  res,
  total_pages = null
) => {
  if (total_pages != null) {
    return res.status(statusCode).json({
      status: statusCode,
      message: Message,
      total_pages: total_pages,
      body: Body,
    });
  } else {
    return res
      .status(statusCode)
      .json({ status: statusCode, message: Message, body: Body });
  }
};



const returnResponse = (
  statusCode = 200,
  Message,
  Body = null,
  res,
  metadata = null
) => {
  return res.status(statusCode).json({
    status: statusCode,
    message: Message,
    ...(metadata && { metadata: metadata }),
    ...(Body && { body: Body }),
  });
};
const verifyrequiredparams = (statusCode = 200, body, fields, res) => {
  try {
    let error = false;
    let error_fields = "";
    if (body.length < 1) {
      throw new Error("Body is missing");
    }
    const element = Object.getOwnPropertyNames(body);
    for (const field of fields) {
      if (element.some((e) => e == field)) {
        if (Object.keys(body[field]).length === 0) {
          if (typeof body[field] == "number") {
            continue;
          } else {
            error = true;
            error_fields += field + ", ";
          }
        }
        continue;
      } else {
        error = true;
        error_fields += field + ", ";
      }
    }
    if (error) {
      throw new Error(
        "Required field(s) " +
        error_fields.slice(0, -2) +
        " is missing or empty"
      );
    } else {
      return Promise.resolve();
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

const StringUppercase = (string) => {
  const value = string;
  const splited_names = value.split(" ");
  let capitalizedValue = "";
  for (const iterator of splited_names) {
    capitalizedValue += ` ${iterator.charAt(0).toUpperCase()}${iterator.slice(
      1
    )}`;
  }
  return capitalizedValue.trim();
};

// get employer name and email
const userworker = async (user_id) => {
  // find user and return
  let user = await User.findById(user_id, { name: 1, email: 1 });
  return user;
};

const addDays = (Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
});

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function convertTZ(date, tzString, format) {
  return moment(new Date(date)).tz(tzString).format(format);
}

function sortArrByKey(unordered) {
  return Object.keys(unordered)
    .sort()
    .reduce((obj, key) => {
      obj[key] = unordered[key];
      return obj;
    }, {});
}

const notification_obj = async (user_id, notification_obj) => {
  var FCM = require("fcm-node");
  var serverKey = process.env.FIREBASEKEY;
  var fcm = new FCM(serverKey);
  const devices = await Devices.find(
    { user_id: user_id },
    { device_id: 1, _id: 0, device_type: 1 },
    { sort: { createdAt: -1 } }
  );
  for (const device of devices) {
    let message = {};
    if (device.device_id.length < 10) continue
    if (device.device_type == "android") {
      message = {
        to: device.device_id,
        data: notification_obj,
      };
    } else if (device.device_type == "ios") {
      notification_obj.sound = "default"
      notification_obj.badge = 1,
        notification_obj.body = notification_obj.message
      message = {
        to: device.device_id,
        notification: notification_obj,
      };
    }
    const notificationSave = {
      user_id: user_id,
      title: notification_obj.title,
      message: notification_obj.message,
      type: notification_obj.type,
      status: notification_obj.status,
      color: notification_obj.color,
      object: notification_obj.object
    }
    const notification_check = await Notifications.findOne(notificationSave)
    if (notification_check) continue;
    fcm.send(message, function (err, response) { });
    await Notifications.create(notificationSave);
  }
  // return { data: resp };
};


const extractNumericValue = (value) => {
  return parseFloat(value.replace(/[^\d.-]/g, '')); // Remove all non-numeric characters
};






function getStartAndEndDates(date, type, timezone) {
  type = type || "daily";
  timezone = timezone || "UTC";
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






module.exports = {
  successResponse,
  verifyrequiredparams,
  StringUppercase,
  userworker,
  addDays,
  daysInMonth,
  convertTZ,
  sortArrByKey,
  getStartAndEndDates,
  returnResponse,
};
