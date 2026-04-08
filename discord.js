const {InteractionType} = require('discord-interactions');

module.exports = function discord(req, res) {
  const {type, data} = req.body;
  console.log(req.body);
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }
  res.json({
    message: 'Hello World!',
  });
}
