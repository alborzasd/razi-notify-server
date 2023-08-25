// const { Smsir } = require("smsir-js");
const axios = require("axios");
const { smsApiConfig } = require("../config");

smsApiInstance = axios.create({
  baseURL: smsApiConfig.apiUrl,
  headers: {
    // sms.ir
    // "X-API-KEY": smsApiConfig.apiKey,

    // ghasedak sms
    apikey: smsApiConfig.apiKey,
    'content-type': 'application/x-www-form-urlencoded'
  },
});

// async function hasCreditToSend() {
//   // TODO: send a request to get total credit
//   // to show error if credit to send messages is not enough
// }

async function sendSmsToPhoneNumberList(phoneNumberList, messageText) {
  try {
    if (phoneNumberList?.length === 0) {
      throw new Error("هیچکدام از اعضای کانال، شماره همراه ثبت شده ندارند.");
    }
    const result = await smsApiInstance.post("/", {
      // sms.ir
      // lineNumber: smsApiConfig.sendFromNumber,
      // messageText: messageText,
      // mobiles: phoneNumberList,

      // ghasedak sms
      message: messageText,
      lineNumber: smsApiConfig.sendFromNumber,
      receptor: phoneNumberList.join(","),
    });
    return result;
  } catch (err) {
    const error = new Error();
    error.name = "SmsManagerError"; // used in utilities/handleError
    if (err?.response) {
      // sms.ir
      // error.message = `خطا در ارسال پیامک. جزییات: ${err?.response?.data?.message}`;
      // ghasedak sms
      error.message = `خطا در ارسال پیامک. جزییات: ${err?.response?.data?.result?.message}`;
      error.networkResponseStatus = err?.response?.status;
    } else if (err?.request) {
      error.message = "خطا در ارسال پیامک. جزییات: خطای اتصال شبکه";
      // thers is network error to send request to sms api
      // we consider that an internal server error to show to the client (channel admin)
      error.networkResponseStatus = 500;
    } else {
      error.message = `خطا در ارسال پیامک. جزییات: ${err?.message}`;
      error.networkResponseStatus = 500;
    }

    throw error; // utilities/handleError will catch this
  }
}

// async function test() {
//   try {
//     const response = await sendSmsToPhoneNumberList(
//       ["09038215123"],
//       "https://razi-notify.ir \n\nتست
//     );
//     console.log(response.data);
//   } catch (err) {
//     console.log(err);
//   }
// }
// test();

module.exports = {
  sendSmsToPhoneNumberList,
};
