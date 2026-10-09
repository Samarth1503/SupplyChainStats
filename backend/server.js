const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, (error) => {
  if (error) {
    if (error.code === 'EADDRINUSE') {
      console.error('Port ' + PORT + ' is already in use. Stop the other program or set another PORT.');
    } else {
      console.error('Server could not start:', error.message);
    }
    process.exit(1);
  }
  console.log('API running at http://localhost:' + PORT);
});
