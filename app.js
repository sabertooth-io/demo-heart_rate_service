const express = require('express');
const app = express();
const fs = require('fs');

app.use('/assets', express.static('assets'));

const PORT = process.env.PORT || 3000;

app.listen(process.env.PORT || PORT, function() {
	console.log('Server listening on port', PORT)
});

// routes
app.get('/', function(req, res){
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(fs.readFileSync(__dirname+'/index.html'));
});

app.get(/.js$|.css$/, function(req, res){
  // res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(fs.readFileSync(__dirname + req.url));
});
