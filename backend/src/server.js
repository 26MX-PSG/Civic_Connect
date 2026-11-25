const { createApp } = require('./app');
const config = require('./config');
const mailer = require('./mailer');

createApp().listen(config.port, async () => {
  console.log('CivicConnect API listening on http://localhost:' + config.port);
  const m = await mailer.verify();
  console.log(m.ok ? '[mail] ' + m.message : '[mail] email OFF — ' + m.message + ' (run: npm run mail:test)');
});
