'use strict';
const line = require('@line/bot-sdk');
const express = require('express');
const request = require('request');
const config = {
  channelAccessToken: 'channelAccessToken',
  channelSecret: 'channelSecret',
};
const gMapAPI = {
  key: 'key'
}
const client = new line.Client(config);
const app = express();
app.get('/', (req, res) => {
  res.json("ok");
});
app.post('/callback', line.middleware(config), (req, res) => {
  console.log(req.body.events);
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(`Event ${err}`);
      res.status(500).end();
    });
});
let conversation = {};
// 事件處理
function handleEvent(event) {
  if (event.replyToken === "00000000000000000000000000000000" ||
    event.replyToken === "ffffffffffffffffffffffffffffffff") {
    return Promise.resolve(null);
  }
  if (event.type === 'follow') {
    getProfile(event);
  } else if (event.type === 'message' && event.message.type === 'location') {
    sendRange(event);
  } else if (event.type === 'message' && event.message.type === 'text' && conversation[event.source.userId] !== undefined) {
    getPlaceData(event);
    delete conversation[event.source.userId];
  } else if (event.type === 'message' && event.message.type === 'text') {
    echoText(event);
  } else {
    otherText(event);
  }
  return Promise.resolve(null);
}
// 取得使用者個人資料
function getProfile(event) {
  return new Promise((resolve, reject) => {
    request.get(`https://api.line.me/v2/bot/profile/${event.source.userId}`, {
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      }
    }, (error, response, body) => {
      if (error) {
        console.log('Send message error');
        reject(error);
      } else if (response.statusCode !== 200) {
        console.log('Send message error');
        reject(error);
      } else {
        const data = JSON.parse(body);
        const confirm = {
          type: "text",
          text: `${data.displayName}您好，準備來sharing瞜～～`
        };
        return client.replyMessage(event.replyToken, confirm);
      }
    });
  });
}
// 查詢地點半徑說明對話框
function sendRange(event) {
  conversation[event.source.userId] = event.message;
  const catReply = {
    type: 'text',
    text: '輸入要查詢的地點類型與半徑範例:\r\n300restaruant\r\ncafe100\r\natm 300'
  };
  return client.replyMessage(event.replyToken, catReply);
}
// google地點結果對話框
function getPlaceData(event) {
  event.message.text = event.message.text.toLowerCase();
  const lat = conversation[event.source.userId].latitude;
  const lng = conversation[event.source.userId].longitude;
  let radius = event.message.text.match(/\d/g);
  if (radius === null) {
    radius = 500
  } else {
    radius = radius.join('');
    radius = radius < 5 ? 100 : radius;
  }
  let searchType = event.message.text.match(/[a-zA-z]+/g);
  searchType = searchType === null ? 'restaruant' : searchType.join("").toLowerCase();
  const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?
          location=${lat},${lng}&
          radius=${radius}&
          type=${searchType}&
          language=zh-TW&
          key=${gMapAPI.key}`.replace(/\n/g, '').replace(/\s/g, '');
  request.get(searchUrl, (err, httpResponse, body) => {
    let msgToUser = { type: 'text', text: 'Searching' };
    if (httpResponse.statusCode === 200) {
      const resBody = JSON.parse(body);
      let places = resBody.results.map((p) => {
        return `${p.name}\r\nhttps://www.google.com/maps/place/?q=place_id:${p.place_id}`
      });
      places.unshift(`${radius}公尺內的${searchType}：`);
      msgToUser.text = places.join('\r\n');
    } else {
      msgToUser.text = `沒有找到${radius}公尺內的${searchType}地點。`;
    }
    return client.replyMessage(event.replyToken, msgToUser);
  })
}
// 重複一樣的話
function echoText(event) {
  const echo = { type: 'text', text: event.message.text };
  return client.replyMessage(event.replyToken, echo);
}
// 其他
function otherText(event) {
  const searchReply = { type: 'text', text: '傳送地址給我，我會幫你找附近的地點喔!' };
  return client.replyMessage(event.replyToken, searchReply);
}
const port = process.env.PORT || 3020;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
