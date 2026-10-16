/* Smallest possible function. If /api/ping answers, functions work on this project. */
module.exports = (req, res) => {
  res.status(200).send('pong, node ' + process.version);
};
