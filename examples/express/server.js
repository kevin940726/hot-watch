const express = require('express');
const hotWatchMiddleware = require('../../middleware');

const app = express();

app.use(hotWatchMiddleware());

app.get('/', (req, res) => {
  res.end(require('./a'));
});

app.listen(3000);
