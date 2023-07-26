import "apps-script-jobqueue";
import { Slack } from "./slack/types";

const legacyVerificationToken =
  PropertiesService.getScriptProperties().getProperty(
    "SLACK_VERIFICATION_TOKEN",
  ) ?? "";

const SLACK_BOT_TOKEN =
  PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN") ?? "";

const SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") ?? "";

type UserParameter = {
  name: string;
};

type Parameter = AppsScriptJobqueue.Parameter;
type TimeBasedEvent = AppsScriptJobqueue.TimeBasedEvent;

function jobEventHandler(event: TimeBasedEvent): void {
  JobBroker.consumeJob(event, globalThis);
}

type DoPost = GoogleAppsScript.Events.DoPost;
const doPost = (req: DoPost) => {
  try {
    // Interactivity & Shortcuts (ボタン操作やモーダル送信、ショートカットなど)
    if (req.postData.type === "application/x-www-form-urlencoded") {
      if (typeof req.parameters.payload === "undefined") {
        throw Error("Undefined Request");
      }

      const payload = JSON.parse(req.parameter.payload);

      if (payload.token !== legacyVerificationToken) {
        console.log(
          `Invalid verification token detected (actual: ${payload.token}, expected: ${legacyVerificationToken})`,
        );
        return ContentService.createTextOutput();
      }

      // ショートカットからアプリが起動されたとき
      if (payload.type === "shortcut") {
        console.log("Shortcuts");
        const p: Slack.Interactivity.DialogSubmission = payload;
        if (p.callback_id === "asdf-callback_id") {
          callWebApi("views.open", {
            "trigger_id": p.trigger_id,
            "user_id": p.user.id,
            "view": {
              "callback_id": "asdf-modal-callback_id",
              "title": {
                "type": "plain_text",
                "text": "bot",
                "emoji": true,
              },
              "submit": {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true,
              },
              "type": "modal",
              "close": {
                "type": "plain_text",
                "text": "キャンセル",
                "emoji": true,
              },
              "blocks": [
                {
                  "type": "input",
                  "element": {
                    "type": "plain_text_input",
                    "action_id": "username-action",
                    "placeholder": {
                      "type": "plain_text",
                      "text": "山田太郎",
                    },
                  },
                  "label": {
                    "type": "plain_text",
                    "text": "氏名",
                    "emoji": false,
                  },
                },
              ],
            },
          });
          return ContentService.createTextOutput();
        }

        // 「Submit」が押されたとき
      } else if (payload.type === "view_submission") {
        console.log("recv view_submission");
        const p: Slack.Interactivity.ViewSubmission = payload;
        // モーダルのcallbackのとき
        if (p.view.callback_id === "asdf-modal-callback_id") {
          const stateValues = p.view.state.values;

          console.log(JSON.stringify(stateValues));

          const v = Object.keys(stateValues).map((key) => stateValues[key]);
          const username = v[0]["username-action"].value;
          const data = {
            name: username,
          };
          //writeToSpreadSheet(data);
          JobBroker.enqueueAsyncJob<UserParameter>(writeToSpreadSheet, data);
        }
        return ContentService.createTextOutput();
      }
    }
  } catch (err) {
    console.log(`err : ${err}`);
    return ContentService.createTextOutput();
  }
};

const writeToSpreadSheet = (v: UserParameter): boolean => {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
  sheet.appendRow([v.name, generateDate()]);
  return true;
};

// Reference from : https://qiita.com/seratch/items/2158cb0abed5b8e12809
function callWebApi(apiMethod: string, payload) {
  const params = {};
  Object.assign(params, payload);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "object") {
      params[key] = JSON.stringify(value);
    }
  }
  const response = UrlFetchApp.fetch(`https://slack.com/api/${apiMethod}`, {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    payload: params,
  });
  console.log(`Web API (${apiMethod}) response: ${response}`);
  return response;
}

const generateDate = () => {
  const now = new Date();
  return Utilities.formatDate(now, "Asia/Tokyo", "yyyy年MM月dd日 HH時mm分ss秒");
};
